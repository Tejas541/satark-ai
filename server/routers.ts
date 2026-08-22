import { z } from "zod";

import { COOKIE_NAME } from "../shared/const";
import { analyzeSuspiciousText } from "./scam-analysis";
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
      .input(z.object({ content: z.string().trim().min(6, "Add a little more text to check.").max(5000, "Keep the check under 5,000 characters."), language: z.enum(["hindi", "hinglish", "english"]).default("hinglish") }))
      .mutation(({ input }) => analyzeSuspiciousText(input.content, input.language)),
  }),
});

export type AppRouter = typeof appRouter;
