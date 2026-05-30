// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Static privacy policy. Real prose, intended to be read for
// substance. Factual claims are grounded in actual source behavior:
//   - user doc fields {uid, email, displayName, createdAt} — see
//     src/auth/firstSignIn.ts (NOTE: no profile photo stored).
//   - device-only state: most-recently-used car id in localStorage
//     (src/lib/mru.ts) + the Firebase Auth sign-in session.
//   - sub-processors: Firebase Auth/Firestore/Hosting; Cloudflare DNS
//     (name resolution only, not in the data path).
//   - no analytics, no ads, no location (flog never requests it).
//   - account deletion / data export are MANUAL (email-mediated)
//     today — there is no self-serve button. Do not claim otherwise.
//
// Routed ABOVE flog's global auth switch (App.tsx) so it's reachable
// signed-out. Hash-scroll effect mirrors TermsScreen — see that file.

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';

export function PrivacyScreen() {
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
        flog privacy policy
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
              href="#what-we-collect"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              What we collect
            </a>
          </li>
          <li>
            <a
              href="#device-only"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              What stays on your device
            </a>
          </li>
          <li>
            <a
              href="#what-we-dont-collect"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              What we don&rsquo;t collect
            </a>
          </li>
          <li>
            <a
              href="#sharing"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Who we share with
            </a>
          </li>
          <li>
            <a
              href="#what-others-see"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              What other users see
            </a>
          </li>
          <li>
            <a
              href="#data-controls"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Your controls
            </a>
          </li>
          <li>
            <a
              href="#google-oauth-note"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              A note about Google sign-in
            </a>
          </li>
          <li>
            <a
              href="#cookies-storage"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Cookies and local storage
            </a>
          </li>
          <li>
            <a
              href="#where-data-lives"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Where data lives
            </a>
          </li>
          <li>
            <a
              href="#changes"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              Changes to this policy
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
          flog collects the minimum it needs to let you log fill-ups and
          see mileage stats for your family&rsquo;s cars.{' '}
          <strong>
            No analytics tracking, no ads, no third-party data brokers,
            and flog never asks for or stores your location.
          </strong>{' '}
          Here&rsquo;s the specifics.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          flog is intended for users 16 years of age or older.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="what-we-collect"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          What we collect
        </h2>
        <p className="mt-3">
          When you sign in with Google, we receive and store your{' '}
          <strong>name and email address</strong>. We do{' '}
          <strong>not</strong> store your profile photo. That goes into
          a user record &mdash; one document per account &mdash; so we
          can attribute the fill-ups you log.
        </p>
        <p className="mt-3">
          When you use the app, we store the things you create: your{' '}
          <strong>cars</strong> (name and settings), your{' '}
          <strong>fill-up entries</strong> (odometer reading, gallons,
          cost, date, and which family member logged it), and the{' '}
          <strong>email addresses</strong> you share a car with.
          That&rsquo;s the data flog needs to function.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="device-only"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          What stays on your device
        </h2>
        <p className="mt-3">
          A couple of things never leave your browser:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>Most-recently-used car.</strong> Which car the log
            form last had selected is stored in your browser&rsquo;s
            localStorage, so it reopens on the right car. It never leaves
            your device.
          </li>
          <li>
            <strong>Sign-in session.</strong> Kept in your browser so
            you don&rsquo;t have to sign in on every visit.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2
          id="what-we-dont-collect"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          What we don&rsquo;t collect
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>No analytics or behavioral tracking.</strong> No
            Google Analytics, no Firebase Analytics, no third-party
            event pipeline.
          </li>
          <li>
            <strong>No advertising identifiers.</strong> No ads, and we
            don&rsquo;t set or read any ad-network cookies or device IDs.
          </li>
          <li>
            <strong>No location.</strong> flog never requests your
            location, on the server or the device.
          </li>
          <li>
            <strong>No per-user usage metering.</strong> We don&rsquo;t
            track how much you use the app for billing or rate-limiting.
          </li>
        </ul>
        <p className="mt-3">
          If this ever changes, this policy gets updated first and the
          effective date at the top moves forward.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="sharing"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Who we share with
        </h2>
        <p className="mt-3">
          flog runs on Google Firebase, which acts as our sub-processor:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>Firebase Authentication</strong> (Google Sign-In),{' '}
            <strong>Cloud Firestore</strong> (database), and{' '}
            <strong>Firebase Hosting</strong> see what you store with us,
            because that&rsquo;s where it&rsquo;s stored.
          </li>
          <li>
            Our domain&rsquo;s DNS is managed through{' '}
            <strong>Cloudflare</strong> &mdash; name resolution only. It
            isn&rsquo;t in the data path and doesn&rsquo;t see your
            fill-up data.
          </li>
        </ul>
        <p className="mt-3">
          Google processes this data as our sub-processor under
          Google&rsquo;s standard Data Processing Addendum. Nobody else
          &mdash; no third-party SDKs, no data brokers, no ad networks.
        </p>
        <p className="mt-3">
          <strong>
            We do not sell personal information or share it for
            advertising.
          </strong>
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="what-others-see"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          What other users see
        </h2>
        <p className="mt-3">
          flog is private &mdash; there are no public pages. Family
          members you share a car with can see that car&rsquo;s fill-up
          entries. Each entry records which family member logged it.
        </p>
        <p className="mt-3">
          The car&rsquo;s owner manages the share list and can see the
          email addresses a car is shared with. Your email address
          isn&rsquo;t shown to other viewers alongside entries.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="data-controls"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Your controls
        </h2>
        <p className="mt-3">You have direct control over your data:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>Sign out</strong> from the menu at any time.
          </li>
          <li>
            <strong>Edit or delete individual fill-ups</strong> you have
            access to, in the app.
          </li>
          <li>
            <strong>Delete your account</strong> or get a{' '}
            <strong>copy of your data</strong> by emailing{' '}
            <a
              href="mailto:flog@austindavid.com"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              flog@austindavid.com
            </a>
            . We handle these by hand today; we may add self-serve
            controls later.
          </li>
        </ul>
        <p className="mt-3">
          When you delete your account, what happens to your data
          depends on who owns it:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>Cars you own</strong> &mdash; and every fill-up
            logged on them &mdash; are deleted.
          </li>
          <li>
            <strong>Fill-ups you logged on someone else&rsquo;s car</strong>{' '}
            are kept as part of that car&rsquo;s history, but{' '}
            <strong>anonymized</strong>: we remove the link between
            those entries and you. They belong to the car&rsquo;s owner,
            and keeping them also preserves that car&rsquo;s mileage
            history (deleting them would leave gaps).
          </li>
          <li>
            Your <strong>user record</strong> and your email are removed
            from every car&rsquo;s share list.
          </li>
        </ul>
        <p className="mt-3">
          Because the records on a car you don&rsquo;t own belong to
          that car&rsquo;s owner, we anonymize rather than delete them.
          If you have a concern about a specific entry,{' '}
          <a
            href="mailto:flog@austindavid.com"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            email us
          </a>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="google-oauth-note"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          A note about Google sign-in
        </h2>
        <p className="mt-3">
          Deleting your flog data removes it from us. Google still
          remembers that you authorized our app &mdash; to remove that,
          go to your Google Account &rarr; Security &rarr; Third-party
          apps and revoke access for flog. We can&rsquo;t do this for
          you, but Google honors revocations promptly and the controls
          are easy to find. (Same for every &ldquo;Sign in with
          Google&rdquo; app.)
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="cookies-storage"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Cookies and local storage
        </h2>
        <p className="mt-3">
          flog uses your browser&rsquo;s storage only for your sign-in
          session and the most-recently-used car preference. We
          don&rsquo;t use third-party tracking or analytics cookies. All
          storage is either strictly necessary or functional, so flog
          doesn&rsquo;t display a cookie consent banner.
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="where-data-lives"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Where data lives
        </h2>
        <p className="mt-3">
          flog is hosted on Google Cloud Platform / Firebase, in US
          datacenters. If this is a problem for you,{' '}
          <a
            href="mailto:flog@austindavid.com"
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            contact us
          </a>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2
          id="changes"
          className="text-xl font-semibold tracking-tight text-gray-900"
        >
          Changes to this policy
        </h2>
        <p className="mt-3">
          If we change anything material, we&rsquo;ll update this page
          and the effective date at the top. Major changes &mdash; new
          third-party sharing, new tracking, new categories of collected
          data &mdash; will get a more visible notice before they take
          effect.
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
          Questions, requests, or concerns? Email{' '}
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
          to="/tos"
          className="text-blue-700 underline-offset-2 hover:underline"
        >
          terms of service
        </Link>
        .
      </p>
      </article>
    </div>
  );
}
