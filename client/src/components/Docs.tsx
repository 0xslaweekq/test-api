import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Импорт из client/README.md, чтобы не выходить за корень клиента при прод-сборке
import readme from '../../README.md?raw';

export const Docs: React.FC = () => {
  return (
    <div className='prose prose-slate dark:prose-invert max-w-none'>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme as unknown as string}</ReactMarkdown>
    </div>
  );
};

export default Docs;
