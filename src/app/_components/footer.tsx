import Container from "@/app/_components/container";

export function Footer() {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 dark:bg-slate-800 ">
      <Container>

        <div className="py-10 flex flex-row lg:flex-row items-center justify-center">

            {/* LinkedIn */}
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-7/8">
            <a href="https://github.com/Joelmillr" target="_blank" rel="noopener noreferrer">
              <img src="/Github-logo.svg" alt="GitHub Logo" className="h-12 w-12" />
            </a>
          </div>

            {/* email */}
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-7/8">
            <a href="mailto:Joelmiller0430@gmail.com" target="_blank" rel="noopener noreferrer">
              <img src="/email-icon.webp" alt="email Logo" className="h-14 w-14" />
            </a>
          </div>

            {/* GitHub */}
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-7/8">
            <a href="https://github.com/Joelmillr" target="_blank" rel="noopener noreferrer">
              <img src="/linkedIn-logo.png" alt="LinkedIn Logo" className="h-12 w-12" />
            </a>

          </div>

            {/* ORCID */}
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-7/8">
            <a href="https://orcid.org/0009-0004-5678-6601" target="_blank" rel="noopener noreferrer">
              <img src="/orcid-logo.png" alt="ORCID Logo" className="h-12 w-12" />
            </a>
          </div>
          
        </div>

      </Container>
    </footer>
  );
}

export default Footer;
