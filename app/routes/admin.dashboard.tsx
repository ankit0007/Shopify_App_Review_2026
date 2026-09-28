import {useLoaderData} from 'react-router';
import {db} from '../db.server';
import {requirePlatformAdmin} from '../modules/admin/session.server';

export async function loader({request}: {request: Request}) {
  await requirePlatformAdmin(request);
  const [shops, activeShops, reviews, approved, pending, rejected, requests, acceptedEmails, failedEmails] = await Promise.all([
    db.shop.count(),
    db.shop.count({where: {uninstalledAt: null}}),
    db.review.count({where: {deletedAt: null}}),
    db.review.count({where: {status: 'APPROVED', deletedAt: null}}),
    db.review.count({where: {status: 'PENDING', deletedAt: null}}),
    db.review.count({where: {status: 'REJECTED', deletedAt: null}}),
    db.reviewRequest.count(),
    db.emailDelivery.count({where: {status: 'ACCEPTED'}}),
    db.emailDelivery.count({where: {status: 'FAILED'}}),
  ]);
  return {shops, activeShops, reviews, approved, pending, rejected, requests, acceptedEmails, failedEmails};
}

export default function PlatformDashboard() {
  const data = useLoaderData<typeof loader>();
  const rows = [
    ['Installed shops', data.shops],
    ['Active shops', data.activeShops],
    ['Reviews', data.reviews],
    ['Approved reviews', data.approved],
    ['Pending reviews', data.pending],
    ['Rejected reviews', data.rejected],
    ['Review requests', data.requests],
    ['Accepted emails', data.acceptedEmails],
    ['Failed emails', data.failedEmails],
  ];
  return (
    <section>
      <h1>Dashboard</h1>
      <ul>{rows.map(([label, value]) => <li key={label}>{label}: {value}</li>)}</ul>
    </section>
  );
}
