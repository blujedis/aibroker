import bcrypt from 'bcryptjs';

export function fromBuffer(value = '') {
  return Buffer.from(value, 'utf-8').toString();
}

export async function hashPasswordWithPepper(password: string, pepper: string) {

  if (!password)
    throw new Error('Cannot hash password with value of null or undefined.');

  if (!pepper)
    throw new Error('Password cannot be hashed without pepper.');

  pepper = fromBuffer(pepper);
  password = fromBuffer(password);

  // Concatenate the pepper and password BEFORE hashing
  const passwordWithPepper = password + pepper;
  const hashedPassword = await bcrypt.hash(passwordWithPepper, 10);
  return hashedPassword; // Store this full hash in your database
}

export async function verifyPasswordWithPepper(password: string, hash: string, pepper: string) {

  if (!password || !hash)
    throw new Error('Cannot verify password with user hash or password of null or undefined.');

  if (!pepper) {
    throw new Error('Pepper is not defined!');
  }

  pepper = fromBuffer(pepper);
  password = fromBuffer(password);

  const passwordWithPepper = password + pepper;
  const isMatch = await bcrypt.compare(passwordWithPepper, hash);

  return isMatch;

}