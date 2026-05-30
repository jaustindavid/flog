// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Static terms of service. Real prose, intended to be read for
// substance. Adapted from the sibling Route7 ToS, retailored to
// flog's actual behavior: private non-commercial family app (no
// public sharing, no maps/location), 16+, manual (email-mediated)
// account deletion/export. Governing law: South Carolina.
//
// Routed ABOVE flog's global auth switch (see App.tsx) so the page
// is reachable signed-out — Google's OAuth review and unauthenticated
// visitors must be able to load it.
//
// Hash-scroll: createBrowserRouter does not fire native anchor
// scrolling on SPA route entry, so a direct hit on /tos#contact
// would land at the top. The effect reads useLocation().hash and
// scrolls the matched element into view after mount / on hash change.
// Duplicated inline (also in PrivacyScreen) rather than extracted —
// only two legal pages exist; refactor if a third ever ships.

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';

export function TermsScreen() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);

  return (
    <div className="min-h-screen bg-white">
      <article className="mx-auto max-w-prose px-6 py-10 text-gray-700">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
        flog terms of service
      </h1>
      <p className="mt-3 text-sm text-gray-500">Effective: 2026-05-29</p>

      <nav
        aria-label="On this page"
        className="mt-6 rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          On this page
        </div>
        <ul className="mt-2 space-y-1">
          <li>
            <a
              href="#intro"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Intro
            </a>
          </li>
          <li>
            <a
              href="#who-can-use"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Who can use flog
            </a>
          </li>
          <li>
            <a
              href="#acceptable-use"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Acceptable use
            </a>
          </li>
          <li>
            <a
              href="#your-data"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Your data
            </a>
          </li>
          <li>
            <a
              href="#termination"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Suspension and termination
            </a>
          </li>
          <li>
            <a
              href="#as-is"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              As-is
            </a>
          </li>
          <li>
            <a
              href="#third-party"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Third-party services
            </a>
          </li>
          <li>
            <a
              href="#changes"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Changes to these terms
            </a>
          </li>
          <li>
            <a
              href="#governing-law"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Governing law
            </a>
          </li>
          <li>
            <a
              href="#contact"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Contact
            </a>
          </li>
        </ul>
      </nav>

      <section className="mt-10">
        <h2
          id="intro"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Intro
        </h2>
        <p className="mt-3">
          flog is a small private app for logging fuel fill-ups and
          tracking mileage for a family&rsquo;s cars, built by Austin
          David. By signing in or using the site, you agree to these
          terms. They&rsquo;re short. If something isn&rsquo;t covered
          here, email{' '}
          <a
            href="mailto:flog@austindavid.com"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            flog@austindavid.com
          </a>
          .
        </p>
        <p className="mt-3">
          This is a personal, non-commercial project &mdash; not a
          corporate product. The code is source-available under the
          PolyForm Noncommercial license. We&rsquo;ll be plain-spoken
          about what we expect.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="who-can-use"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Who can use flog
        </h2>
        <p className="mt-3">
          You need to be at least 16 years of age to use flog.
          You&rsquo;ll also need a Google account &mdash; sign-in goes
          through Google.
        </p>
        <p className="mt-3">
          flog is invite-only: access is granted when the operator
          shares a car with your email address. There&rsquo;s no public
          sign-up. If you&rsquo;d like access, email{' '}
          <a
            href="mailto:flog@austindavid.com"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            flog@austindavid.com
          </a>
          .
        </p>
        <p className="mt-3">
          Access may be revoked at the operator&rsquo;s discretion if
          you violate these terms or the spirit of them.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="acceptable-use"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Acceptable use
        </h2>
        <p className="mt-3">
          Use flog to log fill-ups, track your cars&rsquo; mileage, and
          view stats for cars shared with you. That&rsquo;s the intended
          use of the app.
        </p>
        <p className="mt-3">Don&rsquo;t use flog for:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            Unlawful, harassing, threatening, or hateful content in any
            field.
          </li>
          <li>
            Security probing, rate-limit evasion, or scraping the
            service.
          </li>
          <li>Impersonation or misrepresenting your identity.</li>
          <li>
            Mass automation &mdash; bulk-creating entries, accounts, or
            other artifacts.
          </li>
          <li>
            Reverse-engineering the service to build a competing
            product.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2
          id="your-data"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Your data
        </h2>
        <p className="mt-3">
          You own the cars you create. Fill-up entries logged on a car
          are part of that car&rsquo;s record and belong to the
          car&rsquo;s owner &mdash; so when you log a fill-up on a car
          someone shared with you, you&rsquo;re contributing to their
          car&rsquo;s history. We don&rsquo;t claim ownership of your
          data; you give us a limited license to host and display it for
          the purpose of running the app.
        </p>
        <p className="mt-3">
          If you delete your account, cars you own (and all their
          entries) are deleted, and fill-ups you logged on other
          people&rsquo;s cars are kept as part of those cars&rsquo;
          history but anonymized &mdash; no longer linked to you. See
          the{' '}
          <Link
            to="/privacy#data-controls"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            privacy policy
          </Link>{' '}
          for details.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="termination"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Suspension and termination
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            We may suspend or revoke your access for violations of these
            terms, or for behavior inconsistent with the spirit of them.
          </li>
          <li>
            You may stop using flog at any time. To delete your account
            or get a copy of your data, email{' '}
            <a
              href="mailto:flog@austindavid.com"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              flog@austindavid.com
            </a>
            . See the{' '}
            <Link
              to="/privacy#data-controls"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              privacy policy
            </Link>{' '}
            for what that removes.
          </li>
          <li>
            If we discontinue the service, we&rsquo;ll provide{' '}
            <strong>reasonable notice</strong> (email where possible) so
            you can retrieve your data before access ends.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2
          id="as-is"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          As-is
        </h2>
        <p className="mt-3">
          flog is provided as-is, without warranties of any kind. We
          don&rsquo;t guarantee the service is bug-free, uninterrupted,
          or fit for any particular purpose.
        </p>
        <p className="mt-3">
          The mileage and stats flog computes are{' '}
          <strong>informational estimates</strong> derived from the data
          you enter &mdash; not guaranteed accurate. We&rsquo;re not
          liable for any harm arising from your use of the service.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="third-party"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Third-party services
        </h2>
        <p className="mt-3">
          flog uses Google services (Sign-In, Firebase) to function.
          Your use of those services is also subject to Google&rsquo;s
          terms. We&rsquo;re not responsible for changes to those
          services or their availability.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="changes"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Changes to these terms
        </h2>
        <p className="mt-3">
          Material changes get a new effective date at the top of this
          page. Continued use of flog after that date means acceptance
          of the updated terms.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="governing-law"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Governing law
        </h2>
        <p className="mt-3">
          These terms are governed by the laws of the State of South
          Carolina, without regard to conflict-of-laws principles.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="contact"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Contact
        </h2>
        <p className="mt-3">
          Questions about these terms? Email{' '}
          <a
            href="mailto:flog@austindavid.com"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            flog@austindavid.com
          </a>
          .
        </p>
      </section>

      <p className="mt-12 text-sm text-gray-500">
        See also our{' '}
        <Link
          to="/privacy"
          className="text-blue-700 underline-offset-2 hover:underline"
        >
          privacy policy
        </Link>
        .
      </p>
      </article>
    </div>
  );
}
