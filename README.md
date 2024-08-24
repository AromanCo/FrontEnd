# Perfume Shop

Welcome to the Perfume Shop project! This is a modern e-commerce application built using Next.js and React, designed for selling perfumes online. The application includes a variety of features, from a homepage displaying products to a dynamic shopping cart and checkout process.

## Table of Contents

- [Folder Structure](#folder-structure)
  - [components/](#components)
  - [pages/](#pages)
  - [public/](#public)
  - [styles/](#styles)
  - [utils/](#utils)
  - [types/](#types)
- [Configuration Files](#configuration-files)
- [Suggested Pages and Features](#suggested-pages-and-features)
- [Getting Started](#getting-started)

## Folder Structure

### `components/`

This folder contains reusable React components.

- **layout/**: Layout components like `Header`, `Footer`, and `Navbar` used across the site.
- **products/**: Components related to product display.
  - `ProductCard`: For individual product listings.
  - `ProductList`: For a collection of products.
  - `ProductDetails`: For detailed product pages.
- **ui/**: Reusable UI components like `Button`, `Input`, and `Modal`.
- **cart/**: Components related to the shopping cart.
  - `CartItem`: For individual items in the cart.
  - `CartSummary`: Displays the total amount and other cart details.

### `pages/`

This folder contains all the Next.js pages (routes).

- **api/**: API routes for server-side functions, such as fetching products and handling the shopping cart.
- **_app.tsx**: Custom Next.js App component to wrap all pages. Useful for global styles and context providers.
- **_document.tsx**: Custom Next.js Document component for customizing the HTML document.
- **index.tsx**: The homepage of your perfume shop.
- **product/[id].tsx**: A dynamic route for individual product pages, where `[id]` represents the product ID.
- **cart.tsx**: The shopping cart page, displaying all items added to the cart.
- **checkout.tsx**: The checkout page, where users can proceed with their purchase.

### `public/`

This folder contains static assets like images, fonts, and other resources that need to be accessible from the root URL.

- **images/**: Store images, such as product images and the shop logo.

### `styles/`

This folder contains your global styles and Tailwind CSS configuration.

- **globals.css**: Contains global styles for the project.
- **tailwind.css**: Custom Tailwind CSS configuration if needed.

### `utils/`

This folder contains utility functions.

- **api.ts**: Utility functions for API calls (e.g., fetching products, adding items to the cart).
- **helpers.ts**: General helper functions like currency formatting, etc.

### `types/`

This folder contains TypeScript type definitions.

- **index.ts**: Central place for TypeScript types like `Product`, `CartItem`, and `User` that you’ll use throughout the application.

## Configuration Files

- **tailwind.config.js**: Tailwind CSS configuration file.
- **postcss.config.js**: PostCSS configuration file for processing your CSS with Tailwind.
- **tsconfig.json**: TypeScript configuration file.
- **next.config.js**: Next.js configuration file if you need to customize the build process or runtime behavior.
- **package.json**: This file contains metadata about the project, including dependencies and scripts.

## Suggested Pages and Features

### Homepage (`index.tsx`)

- Hero section with a featured product or promotion.
- Product categories (e.g., Men, Women, Unisex).
- List of top-selling perfumes.

### Product Page (`product/[id].tsx`)

- Product image, title, price, and description.
- Add to Cart button.
- Related products section.

### Cart Page (`cart.tsx`)

- List of products added to the cart with the ability to remove items or adjust quantities.
- Summary of the total cost.
- Checkout button.

### Checkout Page (`checkout.tsx`)

- Form to capture shipping and payment details.
- Order summary.
- Place order button.

## Getting Started

To get started with this project, clone the repository and install the dependencies:

```bash
git clone https://github.com/aromaCo/Frontend
cd Frontend
npm install
