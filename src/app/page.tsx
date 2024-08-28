import Container from "@/app/_components/container";
import { Header } from "@/app/_components/header";
import { Resume } from "@/app/_components/resume";

export default function Index() {

  return (
    <main>
      <Container>
        <Header />
        <Resume />
      </Container>
    </main>
  );
}
