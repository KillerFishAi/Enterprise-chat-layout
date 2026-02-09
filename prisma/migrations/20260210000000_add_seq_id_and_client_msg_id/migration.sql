-- AlterTable: 添加 seqId（会话内消息序号）和 clientMsgId（客户端幂等ID）
ALTER TABLE "Message" ADD COLUMN "seqId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Message" ADD COLUMN "clientMsgId" TEXT;

-- 回填：为已有消息按 createdAt 顺序分配 seqId
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "conversationId"
           ORDER BY "createdAt" ASC
         )::integer AS seq
  FROM "Message"
)
UPDATE "Message" m
SET "seqId" = n.seq
FROM numbered n
WHERE m.id = n.id;

-- 添加唯一约束：每个会话内 seqId 唯一
CREATE UNIQUE INDEX "Message_conversationId_seqId_key" ON "Message"("conversationId", "seqId");

-- 添加客户端消息ID唯一索引（允许 NULL，PostgreSQL 默认允许多个 NULL）
CREATE UNIQUE INDEX "Message_clientMsgId_key" ON "Message"("clientMsgId");

-- 性能索引：按会话+序号快速查询
CREATE INDEX "Message_conversationId_seqId_idx" ON "Message"("conversationId", "seqId");
