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
    ];
  },
};

module.exports = nextConfig;
