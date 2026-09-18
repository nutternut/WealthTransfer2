import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ asset?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.asset) {
    redirect(`/assets?asset=${encodeURIComponent(params.asset)}`);
  }
  redirect("/assets?wizard=1");
}
