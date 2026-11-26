import BoardApp from '../../BoardApp';
import ChinaWorkspace from '../../ChinaWorkspace';
export const dynamic='force-dynamic';
export default async function GanttPage({params}:{params:Promise<{boardId:string}>}){const {boardId}=await params;return boardId==='china'?<ChinaWorkspace/>:<BoardApp key={boardId} boardId={boardId}/>;}
