import argon2 from "argon2";

export const PasswordService = {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  },
  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  },
};