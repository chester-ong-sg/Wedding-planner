# Wedding Planner App

A modern web application for planning wedding seating arrangements, built with Next.js, React DnD, and Supabase.

## Features

- Interactive table layout planning
- Drag and drop guest management
- Real-time updates
- Guest list management
- Table capacity tracking
- Multiple table shapes (round, square, rectangular)
- User authentication
- Responsive design

## Tech Stack

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Supabase (Authentication & Database)
- React DnD (Drag and Drop)
- Shadcn UI Components

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/chester-ong-sg/Wedding-planner.git
   cd wedding-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup

1. Create a new Supabase project
2. Run the migration files in the `supabase/migrations` directory
3. Update your environment variables with the new project credentials

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
