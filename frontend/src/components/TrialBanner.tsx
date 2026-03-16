import { useEffect, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';
import api from '../services/api';

interface TrialInfo {
  isTrial: boolean;
  trialEndDate: string | null;
  monthlyFee: number;
}

export function TrialBanner() {
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  useEffect(() => {
    api.get('/my-dashboard/trial-status')
      .then((res) => setTrial(res.data))
      .catch(() => {});
  }, []);

  if (!trial?.isTrial || !trial?.trialEndDate) return null;

  const trialEnd = new Date(trial.trialEndDate);
  const daysLeft = differenceInDays(trialEnd, new Date());
  const endDateFormatted = format(trialEnd, 'MMMM d, yyyy');
  const monthlyFee = trial.monthlyFee || 0;

  if (daysLeft < 0) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <div
      className={`w-full px-4 py-3 flex items-center justify-between text-sm ${
        isUrgent
          ? 'bg-red-50 border-b border-red-200 text-red-800'
          : 'bg-amber-50 border-b border-amber-200 text-amber-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {isUrgent ? <AlertTriangle size={16} /> : <Clock size={16} />}
        <span>
          {daysLeft === 0 ? (
            <strong>Your free trial ends today!</strong>
          ) : daysLeft === 1 ? (
            <strong>Your free trial ends tomorrow!</strong>
          ) : (
            <>
              <strong>{daysLeft} days left</strong> in your free trial
            </>
          )}
          {' — '}
          Your card will be charged <strong>${monthlyFee}/month</strong> automatically on{' '}
          <strong>{endDateFormatted}</strong>.
        </span>
      </div>
    </div>
  );
}
