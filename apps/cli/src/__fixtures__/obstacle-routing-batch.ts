import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";

export function obstacleRoutingBatch(): {
  document: string;
  operations: string;
} {
  let nextId = 0;
  const editor = new Editor({
    idSource: () => `fixture-${nextId++}`,
    rng: () => 0.5,
  });
  editor.setPageKind(editor.currentPageId, "state");
  const elements = [];
  for (let i = 0; i < 3; i++) {
    elements.push(
      editor.buildElement("frame", {
        id: `frame-${i}`,
        semantic: { name: `Stage${i}` },
        visual: { x: i * 500, y: 0, width: 460, height: 900 },
      }),
    );
  }
  const names = ["Idle", "Running", "Paused", "Done"];
  for (let i = 0; i < 20; i++) {
    elements.push(
      editor.buildElement("state.node", {
        id: `state-${i}`,
        semantic: {
          kind: i === 0 ? "initial" : "state",
          name: names[i] ?? `State${i}`,
        },
        visual: {
          x: (i % 3) * 500 + 60,
          y: Math.floor(i / 3) * 110 + 60,
          width: 150,
          height: 60,
        },
      }),
    );
  }
  for (let i = 0; i < 50; i++) {
    const from = i % 20;
    let to = (i * 7 + 3) % 20;
    if (from === to) to = (to + 1) % 20;
    elements.push(
      editor.buildElement("state.transition", {
        id: `edge-${i}`,
        semantic: {
          from: `state-${from}`,
          to: `state-${to}`,
          trigger: `event${i}`,
          routing: "orthogonal",
          routingAvoidObstacles: false,
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return {
    document: serializeDocument(editor.getSnapshot()),
    operations: JSON.stringify(
      Array.from({ length: 50 }, (_, i) => ({
        op: "update",
        id: `edge-${i}`,
        semantic: { routingAvoidObstacles: true },
      })),
    ),
  };
}

// Fractional indexes and page order from the two pre-change input captures.
// Prefix lengths encode the common prefix with the preceding index.
const capturedOrder = {
  multi: {
    page: "k",
    indexes:
      "0:2,0:N,0:O,0:m,0:s,0:v,0:w,0:x,0:z,1:e,1:i,1:r,1:w,1:z,2:U,2:p,2:v,2:w,2:x,2:z,3:F,3:r,3:s,3:w,3:z,4:B,4:S,4:r,4:s,4:y,4:z,5:F,5:X,5:q,5:z,6:h,6:u,6:v,6:z,7:C,7:J,7:e,7:u,7:z,8:N,8:v,8:w,8:z,9:1,9:W,9:m,9:v,9:w,9:z,10:l,10:r,10:w,10:x,10:y,10:z,11:q,11:u,11:y,11:z,12:j,12:z,13:H,13:V,13:q,13:t,13:w,13:y,13:z,14:Q,14:t,14:z,15:8,15:T,15:b,15:g,15:v,15:y,15:z,16:G,16:b,16:n,16:p,16:u,16:z,17:4,17:o,17:u,17:v,17:y,17:z,18:B,18:n,18:q,18:u,18:w,18:x,18:z,19:r,19:y,19:z,20:B,20:O,20:o,20:u,20:y,20:z,21:k,21:p,21:y,21:z,22:Y,22:v,22:w,22:y,22:z,23:R,23:k,23:r,23:u,23:z,24:7,24:S,24:W,24:k,24:y,24:z,25:b,25:v,25:x,25:y,25:z,26:C,26:R,26:Z,26:x,26:y,26:z,27:7,27:c,27:j,27:v,27:x,27:z,28:B,28:p,28:x,28:y,28:z,29:X,29:u,29:y,29:z,30:X,30:c,30:m,30:s,30:u,30:x,30:z,31:m,31:s,31:x,31:z,32:h,32:n,32:r,32:y,32:z,33:j,33:z,34:1,34:r,34:t,34:u,34:x,34:z,35:q,35:s,35:t,35:x,35:y,35:z,36:C,36:D,36:Z,36:f,36:l,36:w,36:y,36:z,37:R,37:f,37:q,37:z,38:v,38:y,38:z,39:h,39:l,39:q,39:v,39:y,39:z,40:O,40:w,40:x,40:y,40:z,41:u,41:y,41:z,42:p,42:y,42:z,43:s,43:z,44:u,44:y,44:z,45:h,45:z,46:y,46:z,47:s,47:u,47:z,48:I,48:O,48:V,48:c,48:e,48:i,48:q,48:x,48:y,48:z,49:j,49:s,49:x,49:y,49:z,50:J,50:f,50:n,50:v,50:z,51:m,51:o,51:y,51:z,52:3,52:w,52:x,52:z,53:2,53:J,53:h,53:q,53:w,53:z,54:9,54:G,54:r,54:z,55:J,55:l,55:x,55:y,55:z,56:O,56:X,56:y,56:z,57:R,57:d,57:n,57:y,57:z,58:E,58:S,58:y,58:z,59:n,59:u,59:v,59:w,59:y,59:z,60:T,60:m,60:s,60:v,60:x,60:y,60:z,61:i,61:w,61:z,62:Y,62:a,62:y,62:z,63:X,63:p,63:q,63:s,63:y,63:z,64:B,64:C,64:V,64:c,64:s,64:y,64:z,65:A,65:P,65:j,65:k,65:o,65:q,65:y,65:z,66:v,66:y,66:z,67:N,67:y,67:z,68:a,68:x,68:y,68:z,69:v,69:x,69:z,70:5,70:e,70:n,70:v,70:y,70:z,71:W,71:z,72:4,72:5,72:8,72:j,72:z,73:O,73:k,73:z,74:t,74:z,75:y,75:z,76:d,76:j,76:m,76:v,76:x,76:y,76:z,77:z,78:8,78:q,78:r,78:s,78:w,78:y,78:z,79:F,79:L,79:Z,79:j,79:l,79:r,79:u,79:z,80:1,80:B,80:q,80:y,80:z,81:K,81:N,81:y,81:z,82:A,82:j,82:k,82:l,82:m,82:q,82:v,82:x,82:z,83:n,83:x,83:y,83:z,84:6,84:F,84:u,84:x,84:y,84:z,85:V,85:X,85:n,85:w,85:x,85:y,85:z,86:2,86:a,86:i,86:y,86:z,87:r,87:s,87:t,87:u,87:v,87:w,87:y,87:z,88:2,88:9,88:X,88:t,88:v,88:x,88:y,88:z,89:M,89:r,89:w,89:x,89:y,89:z,90:s,90:t,90:z,91:y,91:z,92:v,92:y,92:z,93:7,93:k,93:z,94:Y,94:u,94:y,94:z,95:y,95:z,96:E,96:I,96:b,96:c,96:i,96:r,96:v,96:x,96:z,97:z,98:G,98:e,98:x,98:y,98:z,99:H,99:L,99:u,99:w,99:x,99:z,100:e,100:q,100:s,100:v,100:y,100:z,101:6,101:Z,101:a,101:k,101:x,101:z,102:h,102:n,102:o,102:p,102:x,102:y,102:z,103:A,103:n,103:w,103:x,103:y,103:z,104:5,104:q,104:v,104:z,105:y,105:z,106:V,106:m,106:t,106:y,106:z,107:V,107:n,107:o,107:p,107:w,107:y,107:z,108:c,108:t,108:v,108:z,109:9,109:J,109:r,109:s,109:x,109:z,110:j,110:s,110:z,111:M,111:o,111:r,111:v,111:y,111:z,112:8,112:i,112:j,112:u,112:v,112:y,112:z,113:K,113:g,113:s,113:u,113:x,113:y,113:z,114:M,114:x,114:y,114:z,115:f,115:v,115:y,115:z,116:U,116:s,116:y,116:z,117:t,117:u,117:x,117:y,117:z,118:U,118:y,118:z,119:g,119:u,119:w,119:x,119:z,120:H,120:Z,120:h,120:y,120:z,121:a,121:d,121:o,121:y,121:z,122:m,122:p,122:y,122:z,123:W,123:r,123:z,124:7,124:c,124:s,124:u,124:w,124:y,124:z,125:h,125:y,125:z,126:j,126:p,126:u,126:z,127:2,127:D,127:s,127:v,127:x,127:z,128:h,128:m,128:n,128:x,128:y,128:z,129:C,129:y,129:z,130:b,130:n,130:q,130:w,130:z,131:k,131:m,131:n,131:u,131:y,131:z,132:z,133:9,133:b,133:x,133:z,134:Y,134:y,134:z,135:L,135:T,135:U,135:p,135:v,135:x,135:z,136:G,136:p,136:u,136:x,136:y,136:z,137:f,137:j,137:t,137:u,137:w,137:x,137:z,138:4,138:8,138:D,138:d,138:v,138:z,139:d,139:y,139:z,140:A,140:K,140:q,140:x,140:y,140:z,141:r,141:y,141:z,142:o,142:t,142:u,142:v,142:w,142:x,142:y,142:z,143:U,143:w,143:z,144:e,144:j,144:n,144:y,144:z,145:6,145:a,145:z,146:e,146:j,146:x,146:y,146:z,147:j,147:y,147:z,148:4,148:u,148:z,149:o,149:t,149:y,149:z,150:Y,150:d,150:e,150:x,150:y,150:z,151:n,151:w,151:x,151:y,151:z,152:f,152:y,152:z,153:z,154:9,154:z,155:g,155:s,155:t,155:x,155:z,156:G,156:W,156:h,156:u,156:y,156:z,157:B,157:N,157:j,157:r,157:s,157:t,157:w,157:x,157:y,157:z,158:4,158:s,158:y,158:z,159:k,159:u,159:y,159:z,160:b,160:d,160:y,160:z,161:F,161:x,161:z,162:q,162:u,162:z,163:b,163:s,163:z,164:1,164:J,164:R,164:q,164:s,164:w,164:z,165:V,165:d,165:p,165:z,166:k,166:s,166:z,167:p,167:z,168:w,168:z,169:u,169:z,170:e,170:g,170:m,170:v,170:x,170:z,171:e,171:j,171:q,171:y,171:z,172:t,172:y,172:z,173:4,173:O,173:s,173:x,173:z,174:1,174:C,174:m,174:s,174:z,175:v,175:y,175:z,176:y,176:z,177:p,177:s,177:w,177:y,177:z,178:6,178:9,178:j,178:w,178:y,178:z,179:m,179:t,179:x,179:y,179:z,180:H,180:R,180:d,180:g,180:x,180:z,181:W,181:w,181:x,181:y,181:z,182:J,182:a,182:s,182:x,182:z,183:s,183:w,183:z,184:U,184:Z,184:e,184:x,184:y,184:z,185:M,185:N,185:z,186:F,186:S,186:c,186:d,186:x,186:y,186:z,187:v,187:x,187:z,188:v,188:y,188:z,189:F,189:o,189:w,189:y,189:z,190:9,190:o,190:r,190:t,190:w,190:z,191:q,191:r",
  },
  mixed: {
    page: "Y",
    indexes:
      "0:W,0:n,0:y,0:z,1:P,1:r,1:s,1:y,1:z,2:8,2:G,2:f,2:r,2:u,2:w,2:z,3:E,3:o,3:s,3:u,3:x,3:z,4:B,4:u,4:x,4:z,5:W,5:s,5:w,5:z,6:R,6:c,6:j,6:k,6:t,6:z,7:W,7:i,7:m,7:p,7:x,7:y,7:z,8:f,8:q,8:v,8:z,9:j,9:l,9:o,9:v,9:z,10:R,10:d,10:i,10:z,11:f,11:x,11:y,11:z,12:F,12:R,12:u,12:y,12:z,13:c,13:z,14:I,14:U,14:m,14:t,14:y,14:z,15:D,15:U,15:z,16:R,16:e,16:t,16:v,16:y,16:z,17:u,17:z,18:4,18:r,18:s,18:z,19:8,19:L,19:k,19:l,19:p,19:t,19:z,20:n,20:r,20:y,20:z,21:T,21:X,21:o,21:x,21:z,22:V,22:s,22:x,22:y,22:z,23:g,23:o,23:w,23:z,24:K,24:q,24:s,24:u,24:x,24:z,25:T,25:j,25:s,25:v,25:y,25:z,26:x,26:z,27:J,27:O,27:m,27:o,27:w,27:z,28:o,28:p,28:u,28:w,28:z,29:9,29:H,29:d,29:v,29:x,29:z,30:8,30:M,30:r,30:y,30:z,31:Y,31:p,31:z,32:f,32:j,32:n,32:q,32:t,32:v,32:w,32:z,33:X,33:Y,33:j,33:x,33:z,34:E,34:m,34:n,34:u,34:y,34:z,35:G,35:M,35:w,35:y,35:z,36:1,36:n,36:o,36:q,36:v,36:w,36:y,36:z,37:h,37:l,37:q,37:r,37:u,37:z,38:K,38:Q,38:z,39:z,40:c,40:n,40:o,40:u,40:y,40:z,41:Z,41:a,41:o,41:t,41:y,41:z,42:v,42:x,42:y,42:z,43:W,43:z,44:T,44:f,44:p,44:s,44:x,44:z,45:T,45:h,45:l,45:s,45:z,46:r,46:w,46:z,47:I,47:t,47:z,48:2,48:u,48:x,48:z,49:Q,49:X,49:q,49:z,50:r,50:s,50:y,50:z,51:a,51:x,51:z,52:T,52:t,52:u,52:w,52:x,52:z,53:X,53:Y,53:y,53:z,54:9,54:h,54:q,54:z,55:n,55:x,55:z,56:1,56:h,56:l,56:q,56:y,56:z,57:n,57:z,58:E,58:v,58:y,58:z,59:z,60:t,60:y,60:z,61:M,61:h,61:v,61:x,61:y,61:z,62:D,62:z,63:K,63:Z,63:p,63:t,63:u,63:v,63:z,64:5,64:x,64:y,64:z,65:b,65:d,65:x,65:y,65:z,66:s,66:x,66:y,66:z,67:1,67:b,67:y,67:z,68:Y,68:m,68:v,68:w,68:y,68:z,69:v,69:y,69:z,70:4,70:G,70:q,70:y,70:z,71:t,71:x,71:y,71:z,72:B,72:Z,72:i,72:l,72:n,72:u,72:y,72:z,73:E,73:T,73:t,73:w,73:z,74:r,74:x,74:y,74:z,75:4,75:b,75:h,75:u,75:x,75:y,75:z,76:u,76:w,76:x,76:y,76:z,77:y,77:z,78:W,78:h,78:j,78:m,78:r,78:y,78:z,79:D,79:v,79:y,79:z,80:F,80:r,80:u,80:y,80:z,81:y,81:z,82:w,82:z,83:s,83:x,83:z,84:o,84:t,84:w,84:z,85:C,85:u,85:x,85:z,86:S,86:U,86:h,86:s,86:y,86:z,87:K,87:Q,87:Z,87:a,87:e,87:j,87:m,87:q,87:s,87:x,87:y,87:z,88:Q,88:g,88:p,88:s,88:y,88:z,89:o,89:p,89:x,89:y,89:z,90:I,90:p,90:y,90:z,91:w,91:z,92:F,92:Y,92:c,92:n,92:t,92:z,93:L,93:U,93:c,93:x,93:y,93:z,94:q,94:u,94:x,94:y,94:z,95:E,95:n,95:p,95:w,95:z,96:9,96:c,96:z,97:S,97:i,97:r,97:v,97:x,97:y,97:z,98:l,98:v,98:y,98:z,99:K,99:v,99:z,100:Z,100:b,100:q,100:y,100:z,101:I,101:q,101:t,101:z,102:L,102:k,102:s,102:w,102:z,103:3,103:S,103:n,103:r,103:v,103:y,103:z,104:s,104:w,104:x,104:y,104:z,105:y,105:z,106:H,106:v,106:y,106:z,107:R,107:o,107:s,107:t,107:v,107:y,107:z,108:7,108:t,108:x,108:z,109:j,109:z,110:I,110:m,110:n,110:z,111:B,111:w,111:x,111:y,111:z,112:q,112:y,112:z,113:L,113:h,113:y,113:z,114:B,114:n,114:s,114:y,114:z,115:x,115:y,115:z,116:i,116:m,116:n,116:r,116:z,117:z,118:L,118:f,118:p,118:w,118:x,118:y,118:z,119:D,119:z,120:M,120:V,120:Y,120:h,120:w,120:x,120:z,121:R,121:V,121:n,121:u,121:v,121:y,121:z,122:o,122:t,122:y,122:z,123:T,123:w,123:z,124:D,124:q,124:u,124:x,124:y,124:z,125:s,125:y,125:z,126:u,126:y,126:z,127:i,127:t,127:u,127:v,127:x,127:y,127:z,128:j,128:s,128:x,128:y,128:z,129:S,129:p,129:v,129:w,129:y,129:z,130:o,130:s,130:w,130:x,130:y,130:z,131:L,131:l,131:w,131:z,132:7,132:L,132:y,132:z,133:l,133:x,133:y,133:z,134:W,134:z,135:T,135:y,135:z,136:G,136:u,136:y,136:z,137:Z,137:g,137:w,137:z,138:F,138:n,138:o,138:t,138:z,139:q,139:z,140:Y,140:c,140:u,140:x,140:y,140:z,141:4,141:h,141:u,141:w,141:x,141:y,141:z,142:K,142:s,142:z,143:i,143:p,143:y,143:z,144:h,144:l,144:s,144:z,145:g,145:z,146:d,146:z,147:s,147:z,148:b,148:n,148:p,148:x,148:z,149:Q,149:p,149:r,149:s,149:z,150:x,150:y,150:z,151:G,151:T,151:z,152:W,152:t,152:u,152:w,152:y,152:z,153:u,153:x,153:z,154:v,154:z,155:t,155:z,156:x,156:z,157:S,157:q,157:s,157:v,157:z,158:3,158:s,158:w,158:y,158:z,159:7,159:r,159:v,159:w,159:y,159:z,160:d,160:r,160:u,160:y,160:z,161:U,161:f,161:g,161:q,161:x,161:z,162:G,162:a,162:q,162:t,162:v,162:w,162:z,163:g,163:m,163:v,163:x,163:z,164:Z,164:k,164:t,164:y,164:z,165:u,165:z,166:N,166:y,166:z,167:y,167:z,168:i,168:m,168:y,168:z,169:5,169:7,169:L,169:V,169:p,169:v,169:y,169:z,170:B,170:n,170:u,170:y,170:z,171:6,171:H,171:j,171:m,171:x,171:z,172:q,172:w,172:z,173:p,173:s,173:v,173:x,173:z,174:M,174:X,174:Z,174:l,174:t,174:v,174:w,174:y,174:z,175:L,175:P,175:i,175:o,175:t,175:w,175:y,175:z,176:2,176:t,176:w,176:y,176:z,177:E,177:V,177:w,177:z,178:E,178:L,178:v,178:z,179:R,179:t,179:z,180:u,180:v,180:y,180:z,181:l,181:v,181:x,181:z,182:k,182:v,182:x,182:z,183:b,183:v,183:z,184:J,184:n,184:s,184:t,184:u,184:v,184:z,185:1,185:8,185:E,185:g,185:u,185:x,185:z,186:J,186:a,186:h,186:o,186:w,186:z,187:A,187:x,187:z,188:8,188:q,188:x,188:y,188:z,189:X,189:w,189:y,189:z,190:2,190:Z,190:f,190:l,190:p,190:r,190:w,190:x,190:z,191:R,191:c,191:t,191:z,192:v,192:z,193:y,193:z,194:c,194:s,194:v,194:y,194:z,195:V,195:t,195:z,196:8,196:y,196:z,197:4,197:B,197:E,197:i,197:z,198:B,198:F,198:l,198:z,199:G,199:V,199:s,199:x",
  },
} as const;

function restoreCapturedOrder(
  document: string,
  capture: "multi" | "mixed",
): string {
  const parsed = parseDocument(document);
  const values = capturedOrder[capture].indexes.split(",");
  const indexes = new Map<string, string>();
  let previous = "";
  for (let i = 0; i < values.length; i++) {
    const entry = values[i];
    if (entry === undefined) throw new Error("Missing captured index");
    const colon = entry.indexOf(":");
    previous =
      previous.slice(0, Number(entry.slice(0, colon))) + entry.slice(colon + 1);
    indexes.set(i < 600 ? `grid-node-${i}` : `grid-edge-${i - 600}`, previous);
  }
  return serializeDocument({
    ...parsed,
    pages: parsed.pages.map((page) =>
      page.id === "grid-page"
        ? { ...page, order: capturedOrder[capture].page }
        : page,
    ),
    elements: parsed.elements.map((element) => {
      const index = indexes.get(element.id);
      return index === undefined ? element : { ...element, index };
    }),
  });
}

function buildMultiPage(capture: "multi" | "mixed"): {
  document: string;
  operations: string;
} {
  const fixture = obstacleRoutingBatch();
  const editor = new Editor();
  editor.loadDocument(parseDocument(fixture.document));
  const page = editor.createPage({ id: "grid-page", name: "Grid" });
  editor.setCurrentPage(page);
  editor.setPageKind(page, "freeform");
  const elements = [];
  for (let i = 0; i < 600; i++) {
    elements.push(
      editor.buildElement("node.generic", {
        id: `grid-node-${i}`,
        semantic: { label: `Widget${String(i).padStart(3, "0")}` },
        visual: {
          x: (i % 30) * 180,
          y: Math.floor(i / 30) * 120,
          width: 120,
          height: 60,
        },
      }),
    );
  }
  for (let i = 0; i < 300; i++) {
    const from = Math.floor(i / 15) * 30 + (i % 15) * 2;
    elements.push(
      editor.buildElement("edge.generic", {
        id: `grid-edge-${i}`,
        semantic: {
          from: `grid-node-${from}`,
          to: `grid-node-${from + 1}`,
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return {
    document: restoreCapturedOrder(
      serializeDocument(editor.getSnapshot()),
      capture,
    ),
    operations: fixture.operations,
  };
}

export function obstacleRoutingMultiPage(): {
  document: string;
  operations: string;
} {
  return buildMultiPage("multi");
}

function mixedOperations(): string {
  const operations: object[] = [];
  for (let i = 0; i < 50; i++) {
    if (i < 20)
      operations.push({
        op: "move",
        id: `state-${i}`,
        x: (i % 3) * 500 + 70,
        y: Math.floor(i / 3) * 110 + 70,
      });
    if (i < 3)
      operations.push({
        op: "update",
        id: `frame-${i}`,
        visual: { x: i * 500 + 10, y: 10 },
      });
    operations.push({
      op: "update",
      id: `edge-${i}`,
      semantic: { routingAvoidObstacles: true },
    });
  }
  return JSON.stringify(operations);
}

export function obstacleRoutingMixedSinglePage(): {
  document: string;
  operations: string;
} {
  return {
    document: obstacleRoutingBatch().document,
    operations: mixedOperations(),
  };
}

export function obstacleRoutingMixedMultiPage(): {
  document: string;
  operations: string;
} {
  return {
    document: buildMultiPage("mixed").document,
    operations: mixedOperations(),
  };
}
