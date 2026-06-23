/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/enroll',
        permanent: false,
      },
      {
        source: '/contact',
        destination: '/enroll',
        permanent: false,
      },
      {
        source: '/faq',
        destination: '/enroll',
        permanent: false,
      },
      {
        source: '/updates',
        destination: '/enroll',
        permanent: false,
      },
      {
        source: '/s/:code*',
        destination: '/verify?token=:code*',
        permanent: false, // 302 temporary redirect
      },
    ];
  },
};

module.exports = nextConfig;
