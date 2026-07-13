// 스파크라인/영역 차트를 Canvas 2D로 그리는 순수 함수.
// SmartOptimization의 18개 캔버스가 공유한다. 컴포넌트 상태에 의존하지 않으므로
// 모듈로 분리해 재사용성과 테스트 용이성을 높였다(동작은 기존과 동일).
//
// @param {CanvasRenderingContext2D} ctx
// @param {Array<{value:number}>} data  시계열 데이터
// @param {string} color  라인/영역 색상 (hex, 예: '#35e0d0')
// @param {number} maxValue  y축 최댓값 정규화 기준
const GRID_BG = '#1A1A1E';
const GRID_LINE = '#2a2a2a';

export function drawChart(ctx, data, color, maxValue) {
  if (!ctx || !ctx.canvas) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // 배경 지우기
  ctx.fillStyle = GRID_BG;
  ctx.fillRect(0, 0, width, height);

  // 그리드 그리기
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const y = (height / 10) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 데이터가 없으면 그리드만 표시하고 종료
  if (!data || data.length === 0) {
    return;
  }

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (width / (data.length - 1)) * i : width / 2;
    const y = height - Math.max(0, Math.min(height, (d.value / maxValue) * height));
    return { x, y };
  });

  // 영역 차트 그리기 (라인 아래 영역 채우기)
  if (points.length > 1) {
    // 그라디언트 생성 (영역 채우기용)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '00'); // 투명도 추가

    // 영역 채우기
    ctx.fillStyle = color + '40'; // 약간 투명한 색상 (hex alpha: 40 = 약 25% 불투명도)
    ctx.beginPath();
    ctx.moveTo(points[0].x, height); // 왼쪽 하단
    ctx.lineTo(points[0].x, points[0].y); // 첫 번째 점
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height); // 오른쪽 하단
    ctx.closePath();
    ctx.fill();

    // 라인 그리기
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 각 포인트에 점 그리기 (시간별 포인트)
    ctx.fillStyle = color;
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      // 점 주변에 배경색 테두리 추가 (가시성 향상)
      ctx.strokeStyle = GRID_BG;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  } else if (points.length === 1) {
    // 데이터가 1개일 때도 영역으로 표시
    ctx.fillStyle = color + '40';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, points[0].y);
    ctx.lineTo(width, points[0].y);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 라인 그리기
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, points[0].y);
    ctx.lineTo(width, points[0].y);
    ctx.stroke();

    // 포인트에 점 그리기
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GRID_BG;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
