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

## Deployment

The app is automatically deployed to GitHub Pages when changes are pushed to the main branch. You can view the live version at:
https://chester-ong-sg.github.io/Wedding-planner/

To deploy your own instance:

1. Fork this repository
2. Set up GitHub Pages in your repository settings
3. Add your Supabase environment variables as GitHub repository secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Push to the main branch and GitHub Actions will handle the deployment

## CI/CD

This project uses GitHub Actions for:
- Continuous Integration (CI)
  - Automated testing
  - Code linting
  - Build verification
- Continuous Deployment (CD)
  - Automatic deployment to GitHub Pages
  - Environment variable management
  - Build optimization

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
