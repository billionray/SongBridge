import {useLayoutEffect,useRef,type ReactNode} from 'react';

export default function Modal({children,onDismiss,label,labelledBy}:{children:ReactNode;onDismiss:()=>void;label?:string;labelledBy?:string}){
  const ref=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const dialog=ref.current!;
    dialog.showModal();
    return ()=>dialog.close();
  },[]);
  return <dialog ref={ref} className="modal" aria-label={label} aria-labelledby={labelledBy} onCancel={onDismiss}>{children}</dialog>;
}
