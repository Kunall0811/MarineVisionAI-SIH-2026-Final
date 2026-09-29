import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { TrainingApi } from '../api/services';

const STATUS_COLOR: Record<string, string> = {
  QUEUED: 'text-slate-400',
  RUNNING: 'text-cyan-400',
  COMPLETED: 'text-green-400',
  FAILED: 'text-red-400',
};

export default function TrainingPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['training-jobs'], queryFn: TrainingApi.list, refetchInterval: 5000 });
  const jobs = query.data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
        <GraduationCap className="text-cyan-400" size={20} /> Training Jobs
      </h1>
      <p className="text-xs text-slate-500 -mt-4">
        Real softmax-classifier training over pixel-statistics features (see each job for the honest metrics note). Start a job from a dataset's
        detail page.
      </p>

      <div className="glass-panel rounded-lg divide-y divide-white/5">
        {jobs.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No training jobs yet. Start one from the Datasets page.</div>}
        {jobs.map((j: any) => (
          <div key={j._id} className="p-4 flex items-center justify-between gap-4 text-sm cursor-pointer hover:bg-white/5" onClick={() => navigate(`/training/${j._id}`)}>
            <div>
              <div className="text-slate-100 font-medium">Job {j._id.slice(-6)}</div>
              <div className="text-xs text-slate-500">
                {j.hyperparameters.epochs} epochs &middot; lr {j.hyperparameters.learningRate} &middot; augmentation{' '}
                {j.hyperparameters.useAugmentation ? 'on' : 'off'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xs font-medium ${STATUS_COLOR[j.status]}`}>{j.status}</div>
              <div className="text-[11px] text-slate-500">{j.progressPct}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
