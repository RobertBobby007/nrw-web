"use client";

export type ChatReportPayload = {
  messageId: string;
  chatId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
};

export async function reportChatMessage(payload: ChatReportPayload) {
  return fetch("/api/chat/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
