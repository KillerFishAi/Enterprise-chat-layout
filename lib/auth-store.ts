type User = {
  id: string;
  account?: string;
  phone?: string;
  email?: string;
  password: string;
  nickname: string;
};

// 简单的内存用户存储，仅用于演示
const users: User[] = [];

export function createUser(payload: Omit<User, "id">): User {
  const user: User = {
    ...payload,
    id: `u${Date.now()}`,
  };
  users.push(user);
  return user;
}

export function findUserByCredential(credential: {
  account?: string;
  phone?: string;
  email?: string;
}) {
  return users.find((u) => {
    if (credential.account && u.account === credential.account) return true;
    if (credential.phone && u.phone === credential.phone) return true;
    if (credential.email && u.email === credential.email) return true;
    return false;
  });
}

export function verifyUserLogin(credential: {
  account?: string;
  phone?: string;
  email?: string;
  password: string;
}) {
  const user = findUserByCredential(credential);
  if (!user) return null;
  if (user.password !== credential.password) return null;
  return user;
}

