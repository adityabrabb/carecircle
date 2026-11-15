/**
 * Text helpers.
 *
 * Purpose: small wording rules shared by pages, emails and the
 * assistant, kept in one place so every screen says things the same way.
 */
import type { Member } from './types';

/** Purpose: a count with the right noun, such as "1 dose" or "3 doses". */
export function counted(count: number, one: string, many: string): string {
   return `${count} ${count === 1 ? one : many}`;
}

/** Purpose: the verb that agrees with a count, such as "needs" or "need". */
export function agree(count: number, one: string, many: string): string {
   return count === 1 ? one : many;
}

/**
 * Purpose: a member's name with their role, such as "Arjun (family)".
 * When the name already carries the role, it is not repeated.
 */
export function memberLabel(member: Pick<Member, 'name' | 'role'>): string {
   const role = `(${member.role})`;
   return member.name.includes(role) ? member.name : `${member.name} ${role}`;
}
