export async function api(path) {
  const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(18000)});
  const body=await response.json();
  if(!response.ok) throw Error(body.error || 'Unable to reach Translink.');
  return body;
}
