import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-extrabold">Página não encontrada</h1>
      <p>O endereço pode estar errado ou a página saiu do ar.</p>
      <p>
        <Link href="/" className="underline">
          Voltar para o Explorar
        </Link>
      </p>
    </div>
  );
}
