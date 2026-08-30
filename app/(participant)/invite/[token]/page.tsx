'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { setPendingInvite } from '@/lib/session';

export default function InviteLandingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data) => {
        setPendingInvite(token);
        router.replace(`/campaigns/${data.campaign.id}`);
      })
      .catch(() => setError(true));
  }, [token, router]);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500 mb-4">This invite link is invalid or has expired</p>
        <button onClick={() => router.push('/')} className="text-sm text-soda-600 font-semibold underline">
          Browse campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <p className="text-2xl mb-3">🎉</p>
      <p className="text-sm font-medium text-gray-700">Taking you to the campaign your friend invited you to</p>
    </div>
  );
}
