/*
 * Deterministic cache model for a beginner-facing explanation.
 * Assumptions: one cache entry was written at t=0; TTL is fixed; there is no
 * clock skew, eviction, conditional request, network failure, or concurrency.
 * requestTime is the age of that entry when this request arrives.
 */
globalThis.DiagramModel = function (input, {time}) {
  const ttl = Number(input.ttl);
  const age = Number(input.requestTime);
  const mode = String(input.path);
  const fresh = age < ttl;
  const modeLabel = mode === 'bypass' ? '绕过缓存' : mode === 'stale' ? '允许旧值' : '普通读取';
  const stateLabel = fresh ? '新鲜' : '已过期';
  const outcome = mode === 'bypass'
    ? '绕过缓存'
    : fresh
      ? '缓存命中'
      : mode === 'stale'
        ? '先用旧值，再回源'
        : '缓存未命中，回源';
  const goesOrigin = mode === 'bypass' || !fresh;
  const background = mode === 'stale' && !fresh;
  const sourceLabel = mode === 'bypass' || (!fresh && !background) ? '源站' : background ? '缓存旧值' : '缓存';

  const cacheDetail = fresh
    ? `请求到达时，条目年龄 ${age} 分钟，小于 TTL ${ttl} 分钟，所以它仍然新鲜。普通读取可以直接返回它。`
    : `请求到达时，条目年龄 ${age} 分钟，已达到或超过 TTL ${ttl} 分钟。普通读取不能把它当作新鲜数据。`;
  const decisionDetail = mode === 'bypass'
    ? '这条路径明确跳过缓存检查，适合强制拿最新值的场景；它不会因为缓存是否新鲜而改变。'
    : fresh
      ? '普通读取先检查缓存。新鲜条目直接结束请求，这就是缓存命中。'
      : mode === 'stale'
        ? '允许 stale-while-revalidate：先把过期旧值给用户，再在后台向源站请求新值。'
        : '普通读取发现条目过期，必须向源站请求最新值；这一次就是缓存未命中并回源。';
  const originDetail = mode === 'bypass'
    ? '请求直接到这里，源站返回最新内容；因为选择了绕过缓存，本次演示不写回缓存。'
    : background
      ? '这是后台回源：用户已经拿到旧值，源站返回后把新内容写回缓存。'
      : '回源取得最新内容，随后写回缓存，让下一次普通读取有机会命中。';

  const edge = (id, from, to, start, end, label, color, points) => ({id, from, to, start, end, label, color, points});
  const internal = '#4f5d75';
  const external = '#2e5aa8';
  let edges;
  if (mode === 'bypass') {
    edges = [
      edge('request-origin', 'request', 'origin', 0, 4, '直接请求', external, [[220, 340], [300, 340], [360, 560], [620, 560]]),
      edge('origin-response', 'origin', 'response', 4, 8, '最新内容', external, [[840, 560], [900, 560], [900, 320], [960, 320]])
    ];
  } else if (background) {
    edges = [
      edge('request-cache', 'request', 'cache', 0, 2, '查缓存', internal, [[220, 340], [260, 340], [260, 330], [300, 330]]),
      edge('cache-response', 'cache', 'response', 2, 5, '先返回旧值', internal, [[520, 300], [620, 300], [840, 300], [960, 300]]),
      edge('cache-origin', 'cache', 'origin', 2, 6, '后台回源', external, [[520, 380], [580, 380], [580, 560], [620, 560]]),
      edge('origin-cache', 'origin', 'cache', 6, 9, '写回缓存', external, [[620, 480], [560, 480], [560, 420], [520, 420]])
    ];
  } else {
    edges = [
      edge('request-cache', 'request', 'cache', 0, 2, '查缓存', internal, [[220, 340], [260, 340], [260, 330], [300, 330]]),
      edge('cache-decision', 'cache', 'decision', 2, 4, '判断新鲜度', internal, [[520, 330], [560, 330], [580, 330], [620, 330]])
    ];
    if (fresh) {
      edges.push(edge('decision-response', 'decision', 'response', 4, 8, '命中返回', internal, [[820, 300], [860, 300], [920, 320], [960, 320]]));
    } else {
      edges.push(
        edge('decision-origin', 'decision', 'origin', 4, 6, '过期回源', external, [[720, 400], [720, 440], [730, 500], [730, 560]]),
        edge('origin-response', 'origin', 'response', 6, 9, '写回并返回', external, [[840, 560], [900, 560], [900, 320], [960, 320]])
      );
    }
  }

  const nodes = [
    {
      id: 'request', label: '01 · 发起请求', x: 40, y: 250, w: 180, h: 180,
      color: '#4f5d75', subtitle: `时刻 +${age} 分钟`,
      lines: [`TTL ${ttl} 分钟`, `路径：${modeLabel}`, '等待返回'],
      detail: `请求在缓存条目写入 ${age} 分钟后到达。它选择了“${modeLabel}”，模型据此决定是否先查缓存。`
    },
    {
      id: 'cache', label: '02 · 边缘缓存', x: 300, y: 220, w: 220, h: 220,
      color: '#eb6c36', subtitle: `条目年龄 ${age} 分钟`,
      lines: [`状态：${stateLabel}`, `TTL：${ttl} 分钟`, fresh ? '可以直接使用' : '普通读取不可直接用'],
      detail: cacheDetail
    },
    {
      id: 'decision', label: '03 · 路径判断', x: 620, y: 220, w: 200, h: 220,
      color: '#2d3142', subtitle: `结论：${outcome}`,
      lines: [mode === 'bypass' ? '不检查缓存' : fresh ? '年龄 < TTL' : '年龄 ≥ TTL', `结果：${outcome}`],
      detail: decisionDetail
    },
    {
      id: 'origin', label: '04 · 源站', x: 620, y: 480, w: 220, h: 160,
      color: '#2e5aa8', subtitle: goesOrigin ? 'HTTP / origin' : '本次不经过',
      lines: [goesOrigin ? (background ? '后台取最新值' : '返回最新内容') : '等待下一次回源', background ? '完成后写回缓存' : mode === 'bypass' ? '本次不写回' : '必要时写回'],
      detail: originDetail
    },
    {
      id: 'response', label: '05 · 返回响应', x: 960, y: 220, w: 200, h: 220,
      color: '#4f5d75', subtitle: `来源：${sourceLabel}`,
      lines: [background ? '先返回旧值' : `返回${sourceLabel}内容`, mode === 'bypass' ? '最新但不缓存' : goesOrigin ? '最新值写回缓存' : '无需回源'],
      detail: background
        ? 'stale-while-revalidate 把等待回源的时间藏到后台：本次响应快，但短暂返回旧值。'
        : mode === 'bypass'
          ? '响应来自源站，代表最新内容；绕过缓存会牺牲缓存带来的速度与减负。'
          : fresh
            ? '响应来自缓存，避免访问源站；这就是缓存命中带来的快速路径。'
            : '响应来自源站，且新内容会写回缓存，为后续请求准备新鲜条目。'
    }
  ];

  const timelineNote = background
    ? '过期 + stale：先从缓存返回，再并行回源并写回。'
    : mode === 'bypass'
      ? '绕过缓存：请求直接去源站，不读取也不写回缓存。'
      : fresh
        ? '命中：请求停在缓存，源站没有收到这次请求。'
        : '过期：请求继续去源站，最新内容随后写回缓存。';
  return {
    nodes,
    edges,
    summaryTitle: outcome,
    summary: `条目写入时刻固定为 t=0。现在是 t=${age} 分钟，TTL=${ttl} 分钟；${timelineNote}`,
    metrics: `年龄 ${age} ${fresh ? '<' : '≥'} TTL ${ttl}  →  ${outcome}  ·  回源：${goesOrigin ? '是' : '否'}  ·  写回：${background || (!fresh && mode !== 'bypass') ? '是' : '否'}`
  };
};
