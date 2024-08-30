import Link from "next/link";

export function Header() {
  const openPdfInNewTab = () => {
    window.open('/Resume.pdf', '_blank');
  };

  return (
    <section className="flex-col md:flex-row flex items-center mt-12 mb-6 md:mb-12 space-x-8">

      <h1 className="text-6xl md:text-6xl font-bold tracking-tighter leading-tight">
        <Link href="/" className="hover:underline">
          joel miller
          <img src="/Website_Logo.png" alt="Website Logo" className="h-14 w-14 inline-block ml-2" />
        </Link>
      </h1>

      <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
        <Link href="/" className="hover:underline">
          research & projects
        </Link>
      </h2>

      <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
        <Link href="/Resume.pdf" target="_blank" className="hover:underline">
          resume
        </Link>
      </h2>

    </section>
  );
}

export default Header;
