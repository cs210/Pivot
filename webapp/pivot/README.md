This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### First, add necessary files.
* Add AWS certificate to the parent directory (so `./cs210.cer`)
* Add .env to this directory with the following values:
    * NEXT_PUBLIC_SUPABASE_URL=[]
    * NEXT_PUBLIC_SUPABASE_ANON_KEY=[]
    * AWS_HOST=[IP Address ending in .amazonaws.com]
    * AWS_USER="ubuntu"
    * SSH_KEY_PATH="./cs210.cer"

Make sure to run the following command on cs210.cer:
```
chmod 600 cs210.cer
```

### Then, run the development server.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Setup

This project utilizes Supabase for its backend, including database storage, file storage, and authentication. The setup is defined primarily through SQL scripts and requires some manual configuration in the Supabase dashboard.

### Database Schema

The core database schema is defined using PostgreSQL. The necessary `uuid-ossp` extension is enabled.

**Tables:**

*   `projects`: Stores information about user projects, including name and description. Each project is linked to a `user_id` from `auth.users`.
*   `folders`: Represents a hierarchical folder structure within each project for organizing raw images. Folders belong to a `project_id` and can have an optional `parent_folder_id`.
*   `raw_images`: Contains metadata about uploaded raw image files. Each image belongs to a `project_id`, `user_id`, and optionally a `folder_id` or `panorama_id` (if used to generate a panorama). The actual image file is stored in Supabase Storage.
*   `panoramas`: Stores metadata for generated panorama images, including their `storage_path`, `project_id`, and `user_id`. Associated raw images might be linked via `raw_images.panorama_id`.
*   `grids`: Defines customizable grid layouts for projects, with attributes for rows, columns, visibility settings, and a default flag. Each grid is linked to a `project_id` and `user_id`.
*   `grid_nodes`: Defines nodes within a project's grid layout. Each node has coordinates (`grid_x`, `grid_y`), belongs to a `grid_id` and `project_id`, and can optionally be linked to a specific `panorama_id`.

**Relationships:**

*   `projects` are linked to `auth.users`.
*   `folders`, `raw_images`, `panoramas`, `grids`, and `grid_nodes` are linked to `projects`.
*   `folders` can have parent-child relationships with other `folders`.
*   `raw_images` can optionally belong to `folders`.
*   `raw_images` can optionally link to `panoramas`.
*   `grids` belong to a specific project and user.
*   `grid_nodes` belong to a specific grid and can optionally link to a `panorama`, creating a layout of viewable panoramas within the grid.

**Automatic Timestamps:**

*   Triggers are set up to automatically update the `updated_at` column on `projects`, `folders`, `raw_images`, `panoramas`, `grids`, and `grid_nodes` tables whenever a row is updated.

**Indexes:**

*   Various indexes are created on foreign keys (e.g., `user_id`, `project_id`) and frequently queried columns (e.g., `grid_nodes(grid_x, grid_y)`) to improve query performance.

### Storage Buckets

Two Supabase Storage buckets are required:

1.  `raw-images`: Used to store the actual image files uploaded by users. This bucket should be configured as **private**, as access is controlled via RLS policies on the `raw_images` table metadata and potentially signed URLs.
2.  `panoramas`: Used to store the generated panorama image files. This bucket can be configured as **public** if panoramas are intended to be directly accessible via URL without authentication, or private if access should be restricted.

*Note: Buckets must be created manually via the Supabase Dashboard or Management API.*

#### Storage Bucket Policies

The following RLS policies dictate how users can access objects within the storage buckets:

**Policies for panoramas bucket:**
- Authenticated users can upload panoramas (INSERT)
- Users can update their own panoramas (UPDATE)
- Users can delete their own panoramas (DELETE)
- Users can view their own panoramas (SELECT)
- Anyone (authenticated and anonymous) can view panoramas marked as public in the `panoramas` table

**Policies for raw-images bucket:**
- Authenticated users can upload raw images (INSERT)
- Users can update their own raw images (UPDATE)
- Users can delete their own raw images (DELETE)
- Users can view ONLY their own raw images (SELECT)

These policies ensure that raw images remain private to the uploading user, while panoramas can be either private to the user or made publicly accessible based on the `is_public` flag in the `panoramas` table.

### Row Level Security (RLS)

RLS is enabled on all primary data tables (`projects`, `folders`, `raw_images`, `panoramas`, `grids`, `grid_nodes`) to enforce data privacy and security. The general policy is:

*   **Users can only interact with their own data:** They can select, insert, update, and delete records directly associated with their `user_id` (e.g., their `projects`, `raw_images`, `panoramas`).
*   **Project-based access:** For tables like `folders` and `grid_nodes`, users can interact with records belonging to projects they own.
*   **Public Access:** The `panoramas` table allows public read access (`SELECT`) if the `is_public` flag is set to `TRUE`. Similarly, `grids` marked as public can be viewed by anyone, and `grid_nodes` linked to public grids or public panoramas can also be viewed.

These policies ensure that users can only access data they are authorized to see, based on their authentication status and project ownership.
