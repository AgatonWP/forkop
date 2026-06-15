import { getNation } from '@/lib/nations';
import { NATION_IMAGES } from '@/lib/nationImages';

interface NationEmblemProps {
  nationId: string;
  size?: 'sm' | 'md';
}

export default function NationEmblem({ nationId, size = 'sm' }: NationEmblemProps) {
  const nation = getNation(nationId);
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const image = NATION_IMAGES[nationId];

  if (image) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-card border border-border/50`}
        title={nation.name}
      >
        <img src={image} alt={nation.name} className="h-full w-full object-contain p-0.5" />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-display font-bold text-primary-foreground shrink-0 text-[10px]`}
      style={{ backgroundColor: `hsl(${nation.color})` }}
      title={nation.name}
    >
      {nation.shortName}
    </div>
  );
}
