import Link from "next/link";

export function Header () {
  return (
    <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">

      <h1 className="text-6xl md:text-6xl font-bold tracking-tighter leading-tight md:pr-4">
        <Link href="/" className="hover:underline">
          Joel Miller
        </Link>
      </h1>

      <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight md:pr-4">
        <Link href="/" className="hover:underline">
          research & projects
        </Link>
      </h2>

      <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight md:pr-4 items-center">
        <Link href="/" className="hover:underline">
          contact
        </Link>
      </h2>

    </section>
  );
}

export default Header;
