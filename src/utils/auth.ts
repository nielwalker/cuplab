const USERNAME_PATTERN=/^[a-z0-9][a-z0-9._-]{2,31}$/
export function usernameToAuthEmail(username:string){const normalized=username.trim().toLowerCase();if(!USERNAME_PATTERN.test(normalized))throw new Error('Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.');return `${normalized}@coffee-shop.local`}
