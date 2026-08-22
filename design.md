# Satark AI Mobile Interface Design

## Product Intent

Satark AI is a **text and link safety checker** for Indian users. The product should feel calm, direct, and protective: it helps a user pause before responding to a suspicious message rather than creating alarm. The interface is designed for portrait use on a phone, where a user can paste a forwarded message with one hand and obtain a comprehensible result in a single focused flow.

## Screen List

| Screen | Primary content and functionality |
| --- | --- |
| **Check** | A compact, branded header; plain-language hero; a message/link input field; an example prompt; and an orange **Analyze message** action. This is the default landing screen and is optimized for fast, one-handed paste-and-check use. |
| **Analysis Result** | A large animated score ring; a risk category; a safety recommendation; detected manipulation-tactic chips; URL red flags when relevant; and an explanation in the same language/register as the submitted text. The result remains in context below the input so a user can revise and rescan quickly. |
| **History** | A locally persisted, newest-first list of prior checks. Each row shows a short excerpt, risk score, risk level, and checked time. Selecting a row restores its full analysis details. |
| **About** | A concise explanation of pattern-based scam detection, its distinction from phone-number blockers, language support, and the product's privacy boundary. |

## Primary User Flows

| Flow | Steps |
| --- | --- |
| **Check a suspicious message** | The user opens **Check** → pastes a message or URL → taps **Analyze message** → sees a brief scanning state → reads the score, level, tactics, red flags, and explanation → decides whether to ignore, verify independently, or report the message. |
| **Review a previous check** | The user opens **History** → scans score-coded results → selects a check → returns to **Check** with the saved analysis result visible. |
| **Understand the tool** | The user opens **About** → learns that Satark AI evaluates manipulation patterns in text and links, including tactics that a number-only blocker cannot inspect. |

## Layout and Interaction Design

The product uses a persistent bottom navigation with three labels: **Check**, **History**, and **About**. This provides familiar iOS-style navigation without overwhelming the core task. The Check screen uses a vertically scrollable composition with the primary input and action within the upper thumb-reach zone. The action remains distinct using the sole bright accent color and has a light haptic response on native devices.

The analysis result is treated as a focused decision card rather than a dense report. The risk score appears inside a radar-inspired ring. Safe results use a restrained mint status color, suspicious results use warm amber, and high-risk results use orange-red only to signal severity. Tactic chips and URL findings are visually grouped to support quick scanning. Explanations use generous line height and avoid specialist language.

## Color Choices

| Role | Color | Usage |
| --- | --- | --- |
| **Night base** | `#0A0A0F` | Full-screen background and system surface base. |
| **Elevated glass** | `#171720` | Cards, input container, and bottom navigation surface. |
| **Warm white** | `#F5F5F7` | Primary type and outline treatment in the shield mark. |
| **Quiet gray** | `#A8A6B3` | Supporting labels and descriptions. |
| **Signal orange** | `#FF9500` | Primary actions, the AI wordmark, score accent, and shield-eye pupil. |
| **Safe mint** | `#48D597` | Low-risk result status. |
| **Caution amber** | `#F5C451` | Suspicious result status. |
| **High-risk ember** | `#FF6B35` | High-risk state and urgent recommendation. |

## Typography and Visual Language

The app will use the platform's clean sans-serif system typography for native readability, with a visual hierarchy that supports both Latin and Devanagari content. The wordmark is bold, with **Satark** in warm white and **AI** in signal orange. The shield-eye mark appears as a small, high-contrast companion to the wordmark. Cards use a dark translucent effect through layered charcoal surfaces, thin low-contrast borders, and subtle glows; the styling remains restrained so the safety information is always primary.

## Scope Boundary

This MVP accepts pasted **text, links, and call transcripts only**. It does not request microphone access, record calls, accept audio uploads, or provide phone-number blocking. Analysis history remains on the device through local storage.
