import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vps-5610837-x.dattaweb.com/prod",
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "BI9rlMvmXaxUkboMdzvNOuY6qN9JBA42b23lNdOf_KImIXjHG2blVr7Kn5SKmvSqAfQbBPNY8ib7yMSDv0JBOZA",
  },
};

export default nextConfig;
