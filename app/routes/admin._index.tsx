import {redirect} from 'react-router';

export function loader() {
  return redirect('/admin/dashboard');
}

export default function AdminIndex() {
  return null;
}
