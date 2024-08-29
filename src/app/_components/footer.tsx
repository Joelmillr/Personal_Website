import Container from "@/app/_components/container";
import { Resume } from "@/app/_components/resume";
import { ContactButton } from "@/app/_components/contact-button";


export function Footer() {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 dark:bg-slate-800">
      <Container>
        <div className="py-28 flex flex-col lg:flex-row items-center justify-center">
          <div className="flex flex-col lg:flex-row justify-center items-center lg:pl-4 lg:w-7/8">
          
            <Resume />
            <ContactButton buttonText="LinkedIn" link="https://www.linkedin.com/in/joelmillr/" />
            <ContactButton buttonText="GitHub" link="https://github.com/Joelmillr" />
            <ContactButton buttonText="Email" link="mailto:Joelmiller0430@gmail.com" />
            <ContactButton buttonText="ORCID" link="https://orcid.org/0009-0004-5678-6601" />

          </div>
        </div>

      </Container>
    </footer>
  );
}

export default Footer;
