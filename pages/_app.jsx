import Head from 'next/head';
import '../public/css/styles.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/imgs/canaltop.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
