# Working Configuration Backup

This directory contains a backup of the working configuration files for the Wedding Planner application.

## Files

- `postcss.config.js`: CommonJS PostCSS configuration that works with Next.js
- `next.config.mjs`: Next.js configuration with GitHub Pages settings
- `tailwind.config.ts`: Tailwind CSS configuration
- `package.json`: Project dependencies and scripts

## Why This Configuration Works

The key to making this configuration work was using a CommonJS format for the PostCSS configuration file (`postcss.config.js`) instead of an ES module format. This ensures compatibility with Next.js's font loader and other features.

## How to Restore

If you encounter issues with your configuration, you can restore these files by copying them back to the root directory:

```bash
cp backup-config/* .
```

## Notes

- The PostCSS configuration uses CommonJS syntax (`module.exports`) which is compatible with Next.js
- The Tailwind configuration uses TypeScript format
- The Next.js configuration uses ES module format (`.mjs` extension) 