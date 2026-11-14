export async function importBatch({indices, entries, processTrack, save, stopped}) {
  for (const index of indices) {
    if (stopped()) break;
    const entry = entries[index];
    try {
      await processTrack(index, entry);
      delete entry.error;
      delete entry.notSubmitted;
    } catch (error) {
      // The caller persists pending immediately before a write. Earlier errors are retryable.
      if(entry.status==='matched')entry.notSubmitted=true;
      entry.error = error.message;
    }
    await save();
  }
}

export function recoverUnsubmitted(entry){
 if(entry.status!=='pending'||!entry.candidate||!['有多个同名目标','该版本暂未找到，可单独重试'].includes(entry.error))return false;
 entry.status='matched';entry.notSubmitted=true;return true;
}

export function resetDestination(job){
 job.target=null;job.creationAttempted=false;
 for(const e of Object.values(job.entries)){
  if(!e.candidate)continue;
  if(e.status==='shelved')e.checked=false;
  if(['added','existing','pending','shelved'].includes(e.status))e.status='matched';
  delete e.verifiedTarget;delete e.verifiedId;delete e.notSubmitted;delete e.error;
 }
}
