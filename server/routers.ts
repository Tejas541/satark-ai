import { z } from "zod";

import { COOKIE_NAME } from "../shared/const";
import { analyzeSuspiciousText } from "./scam-analysis";
import { transcribeAudio } from "./_core/voiceTranscription";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  scam: router({
    analyze: publicProcedure
      .input(z.object({ content: z.string().trim().min(6, "Add a little more text to check.").max(5000, "Keep the check under 5,000 characters."), language: z.enum(["hindi", "marathi", "english"]).default("english") }))
      .mutation(({ input }) => analyzeSuspiciousText(input.content, input.language)),
  }),
  audio: router({
    transcribeAndAnalyze: publicProcedure
      .input(z.object({ audioBase64: z.string().min(8).max(17_000_000), mimeType: z.string().min(6).max(80), speechLanguage: z.enum(["hi", "mr", "en"]), analysisLanguage: z.enum(["hindi", "marathi", "english"]) }))
      .mutation(async ({ input }) => {
        const transcription = await transcribeAudio({
          audioUrl: `data:${input.mimeType};base64,${input.audioBase64}`,
          language: input.speechLanguage,
          prompt: "Transcribe a suspicious call recording accurately. Preserve any phone numbers, OTP, KYC, UPI, money amounts, website links, and names.",
        });
        if ("error" in transcription) {
          return { success: false as const, message: "We could not transcribe that recording. Try a shorter, clearer audio file and try again." };
        }
        const analysis = await analyzeSuspiciousText(transcription.text, input.analysisLanguage);
        return { success: true as const, transcript: transcription.text, analysis };
      }),
  }),
});

export type AppRouter = typeof appRouter;
