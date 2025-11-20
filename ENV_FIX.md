# Fix for NEXTAUTH_SECRET Issue

## Problem
NextAuth v5 is not reading the `NEXTAUTH_SECRET` from your `.env` file.

## Solution

In your `.env` file, you have:
```
NEXTAUTH_SECRET="PFD40MCNSZS6Cz3516Nop0jk30S1x/Our0Atf80WsEE="
```

**Remove the quotes** and also add `AUTH_SECRET` (NextAuth v5 prefers this):

```
NEXTAUTH_SECRET=PFD40MCNSZS6Cz3516Nop0jk30S1x/Our0Atf80WsEE=
AUTH_SECRET=PFD40MCNSZS6Cz3516Nop0jk30S1x/Our0Atf80WsEE=
```

Or just use `AUTH_SECRET` (NextAuth v5 standard):
```
AUTH_SECRET=PFD40MCNSZS6Cz3516Nop0jk30S1x/Our0Atf80WsEE=
```

## Steps:
1. Open your `.env` file
2. Remove the quotes around `NEXTAUTH_SECRET` value
3. Add `AUTH_SECRET` with the same value (without quotes)
4. Save the file
5. Restart your dev server (`npm run dev`)

The code has been updated to check for both `AUTH_SECRET` and `NEXTAUTH_SECRET`.




