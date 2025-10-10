// MotorCache.ts
let cache: Record<string, any> = {};

export const MotorCache = {
  setMotor: (id: string, data: any) => {
    cache[id] = data;
  },
  getMotor: (id: string) => cache[id],
  getAllMotors: () => Object.values(cache),
  setAllMotors: (motors: any[]) => {
    cache = {};
    motors.forEach(m => { cache[m._id] = m; });
  },
};
