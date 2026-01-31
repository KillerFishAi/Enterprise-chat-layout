export const currentUser = {
  name: "张明",
  email: "zhangming@company.com",
  department: "产品部",
  title: "产品经理",
};

export const mockChats = [
  {
    id: "1",
    name: "产品团队",
    lastMessage: "明天一起评审Q4路线图",
    timestamp: "10:32",
    unread: 3,
    isGroup: true,
    memberCount: 8,
    online: true,
  },
  {
    id: "2",
    name: "陈晓",
    lastMessage: "感谢项目进度更新",
    timestamp: "09:15",
    online: true,
    status: "在线",
  },
  {
    id: "3",
    name: "李伟",
    lastMessage: "下周可以安排个电话会议吗？",
    timestamp: "昨天",
    unread: 1,
    status: "2小时前在线",
  },
  {
    id: "4",
    name: "研发部",
    lastMessage: "构建已完成",
    timestamp: "昨天",
    isGroup: true,
    memberCount: 12,
  },
  {
    id: "5",
    name: "王芳",
    lastMessage: "设计稿已准备好，请查阅",
    timestamp: "周一",
    online: true,
    status: "在线",
  },
  {
    id: "6",
    name: "刘强",
    lastMessage: "今天的演示做得很棒！",
    timestamp: "周一",
    status: "1天前在线",
  },
  {
    id: "7",
    name: "市场部",
    lastMessage: "营销活动已成功上线",
    timestamp: "周日",
    isGroup: true,
    memberCount: 5,
  },
  {
    id: "8",
    name: "赵敏",
    lastMessage: "会议纪要已发送",
    timestamp: "周五",
    status: "3天前在线",
  },
];

export type GroupMember = {
  id: string;
  name: string;
  role: "admin" | "member";
  status: string;
};

export type Message = {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  senderName: string;
  isOwn: boolean;
  status: "sent" | "delivered" | "read";
  type?: "text" | "file" | "image";
  fileName?: string;
  fileSize?: string;
  imageUrl?: string;
};

export const mockContacts = [
  { id: "c1", name: "陈晓", role: "member", title: "高级设计师", department: "设计部", online: true },
  { id: "c2", name: "韩雪", role: "member", title: "前端开发", department: "研发部" },
  { id: "c3", name: "何涛", role: "member", title: "新媒体运营", department: "市场部" },
  { id: "c4", name: "黄伟", role: "admin", title: "技术总监", department: "管理层" },
  { id: "c5", name: "李伟", role: "member", title: "高级开发", department: "研发部", online: true },
  { id: "c6", name: "林娜", role: "member", title: "品牌设计师", department: "设计部", online: true },
  { id: "c7", name: "刘强", role: "member", title: "开发工程师", department: "研发部" },
  { id: "c8", name: "钱坤", role: "member", title: "运维工程师", department: "研发部", online: true },
  { id: "c9", name: "孙磊", role: "member", title: "运维工程师", department: "研发部" },
  { id: "c10", name: "王芳", role: "member", title: "市场主管", department: "市场部", online: true },
  { id: "c11", name: "吴杰", role: "member", title: "平台工程师", department: "研发部" },
  { id: "c12", name: "徐超", role: "admin", title: "研发经理", department: "研发部" },
  { id: "c13", name: "许萍", role: "member", title: "数据分析师", department: "数据部", online: true },
  { id: "c14", name: "杨蕾", role: "member", title: "内容编辑", department: "市场部" },
  { id: "c15", name: "张明", role: "admin", title: "产品经理", department: "产品部" },
  { id: "c16", name: "赵敏", role: "member", title: "测试工程师", department: "研发部", online: true },
  { id: "c17", name: "郑佳", role: "member", title: "移动端开发", department: "研发部" },
  { id: "c18", name: "周婷", role: "member", title: "安全工程师", department: "研发部" },
];

export const mockGroupMembers: Record<string, GroupMember[]> = {
  "1": [
    { id: "u1", name: "张明", role: "admin", status: "产品经理" },
    { id: "u2", name: "陈晓", role: "member", status: "设计师" },
    { id: "u3", name: "李伟", role: "member", status: "开发工程师" },
    { id: "u4", name: "王芳", role: "member", status: "市场主管" },
    { id: "u5", name: "刘强", role: "member", status: "开发工程师" },
    { id: "u6", name: "赵敏", role: "member", status: "测试工程师" },
    { id: "u7", name: "孙磊", role: "member", status: "运维工程师" },
    { id: "u8", name: "许萍", role: "member", status: "数据分析师" },
  ],
  "4": [
    { id: "u1", name: "张明", role: "admin", status: "技术负责人" },
    { id: "u3", name: "李伟", role: "member", status: "高级开发" },
    { id: "u5", name: "刘强", role: "member", status: "开发工程师" },
    { id: "u6", name: "赵敏", role: "member", status: "测试工程师" },
    { id: "u7", name: "孙磊", role: "member", status: "运维工程师" },
    { id: "u9", name: "徐超", role: "member", status: "后端开发" },
    { id: "u10", name: "韩雪", role: "member", status: "前端开发" },
    { id: "u11", name: "黄伟", role: "member", status: "全栈开发" },
    { id: "u12", name: "郑佳", role: "member", status: "移动端开发" },
    { id: "u13", name: "吴杰", role: "member", status: "平台工程师" },
    { id: "u14", name: "周婷", role: "member", status: "安全工程师" },
    { id: "u15", name: "钱坤", role: "member", status: "运维工程师" },
  ],
  "7": [
    { id: "u1", name: "张明", role: "member", status: "产品部" },
    { id: "u4", name: "王芳", role: "admin", status: "市场主管" },
    { id: "u16", name: "杨蕾", role: "member", status: "内容编辑" },
    { id: "u17", name: "何涛", role: "member", status: "新媒体运营" },
    { id: "u18", name: "林娜", role: "member", status: "品牌设计师" },
  ],
};

export const mockMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      content: "大家好，我想和大家讨论一下Q4路线图的优先级。",
      timestamp: "10:15",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "text",
    },
    {
      id: "m2",
      content: "好的，我认为我们应该优先关注企业版功能。",
      timestamp: "10:18",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "read",
      type: "text",
    },
    {
      id: "m3",
      content: "同意。数据分析仪表板是很多客户反馈最多的需求。",
      timestamp: "10:22",
      senderId: "user2",
      senderName: "李伟",
      isOwn: false,
      status: "read",
      type: "text",
    },
    {
      id: "m4",
      content: "",
      timestamp: "10:25",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "file",
      fileName: "Q4路线图草案.pdf",
      fileSize: "2.4 MB",
    },
    {
      id: "m5",
      content: "我可以在周五前准备一份详细的需求文档。需要包含移动端的改进计划吗？",
      timestamp: "10:28",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "text",
    },
    {
      id: "m6",
      content: "是的，请一并包含。明天下午2点一起评审Q4路线图。",
      timestamp: "10:32",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "delivered",
      type: "text",
    },
    {
      id: "m7",
      content: "",
      timestamp: "10:35",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "delivered",
      type: "image",
      imageUrl: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&h=300&fit=crop",
    },
    {
      id: "m8",
      content: "这是新仪表板布局的线框图",
      timestamp: "10:36",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "delivered",
      type: "text",
    },
  ],
  "2": [
    {
      id: "m1",
      content: "你好，我已经完成了设计稿的评审。",
      timestamp: "09:00",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "text",
    },
    {
      id: "m2",
      content: "太好了！有什么反馈或需要修改的地方吗？",
      timestamp: "09:05",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "read",
      type: "text",
    },
    {
      id: "m3",
      content: "",
      timestamp: "09:08",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "image",
      imageUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop",
    },
    {
      id: "m4",
      content: "整体看起来不错。只是配色方案需要做一些小的调整。",
      timestamp: "09:10",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "text",
    },
    {
      id: "m5",
      content: "",
      timestamp: "09:12",
      senderId: "user1",
      senderName: "陈晓",
      isOwn: false,
      status: "read",
      type: "file",
      fileName: "设计反馈笔记.docx",
      fileSize: "156 KB",
    },
    {
      id: "m6",
      content: "感谢项目进度更新，我今天会完成这些修改。",
      timestamp: "09:15",
      senderId: "current",
      senderName: "我",
      isOwn: true,
      status: "read",
      type: "text",
    },
  ],
};

export function appendMessage(chatId: string, content: string): Message {
  const newMessage: Message = {
    id: `m${Date.now()}`,
    content,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    senderId: "current",
    senderName: "我",
    isOwn: true,
    status: "sent",
    type: "text",
  };

  if (!mockMessages[chatId]) {
    mockMessages[chatId] = [];
  }
  mockMessages[chatId].push(newMessage);
  return newMessage;
}

