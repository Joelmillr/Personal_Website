import Container from "@/app/_components/container";

export function Footer() {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 dark:bg-slate-800">
      <Container>
        <div className="py-28 flex flex-col lg:flex-row items-center justify-center">
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-1/2">
          
            <a href="/"
              className="mx-3 bg-black hover:bg-white hover:text-black border border-black text-white font-bold py-3 px-12 lg:px-8 duration-200 transition-colors mb-6 lg:mb-0"
            >
              Checkout my Resume!
            </a>

            {/* TODO: Add link to resume */}
            {/* TODO: Add link to LinkedIn, github, google scholar, etc. */}

          </div>
        </div>

      </Container>
    </footer>
  );
}

export default Footer;
