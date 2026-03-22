# NBA Letterbox — Claude Instructions

## Workflow Rules
- **Always use `supabase db push`** (via CLI) to apply migrations — never ask which method to use.
- **Always make a git commit** after completing work. Don't wait to be asked.
- Use `--legacy-peer-deps` for npm install due to peer dep conflicts.

## Stack
- Expo SDK 54, Expo Router v6, React Native 0.81.5
- Supabase (auth + database + storage), TanStack Query v5, Zustand v5
- NativeWind v4 + Tailwind CSS v3

## Known Issues
- Pre-existing Supabase `never` type errors in tsc — ignore these.

## Design Context

### Users
Casual NBA fans and social sports fans — on their phones during games, at watch parties, in group chats. The app is where they log games, share takes, compete on rankings, and play party games together.

### Brand Personality
**Bold, Fun, Premium** — high-energy but polished. Think slick sports broadcast meets gaming lobby.

### Aesthetic Direction
- Dark-only (`#0a0a0a` bg, `#1a1a1a` surface, `#2a2a2a` borders). Gold accent `#c9a84c`, red `#e63946`.
- Space Grotesk font. Lucide icons. Reanimated spring animations.
- References: Discord/gaming apps. Anti-refs: generic Material, sterile minimalism.

### Design Principles
1. **Arena energy** — Dark, immersive, pops of team color and gold. Dramatic but not heavy.
2. **Thumb-first** — Large tap targets, bottom-anchored actions, one-handed mobile use.
3. **Show, don't decorate** — Every visual element earns its place. No ornamental effects.
4. **Responsive feedback** — Spring animations, haptics, snappy transitions on every interaction.
5. **Friend group vibes** — Confident but casual copy and tone. Something you'd show off to friends.
