import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, off } from "firebase/database";
import type { ScheduleItem, SpecPlan, DateTrack } from "@/types";

const firebaseConfig = {
  apiKey: "AIzaSyBcczqGj5X1_w9aCX1lOK4-kgz49Oi03Bg",
  authDomain: "scheduling-dd672.firebaseapp.com",
  databaseURL: "https://scheduling-dd672-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scheduling-dd672",
  storageBucket: "scheduling-dd672.firebasestorage.app",
  messagingSenderId: "432092773012",
  appId: "1:432092773012:web:ebc7203ea570b0da2ad281"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };

/** -------------------- schedule -------------------- */
/** 返回未 Finished 且有 Chassis/Customer 的订单数组（保留你的原有行为） */
export const subscribeToSchedule = (callback: (data: ScheduleItem[]) => void) => {
  const scheduleRef = ref(database, "schedule");
  onValue(scheduleRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const scheduleArray = Object.values(data) as ScheduleItem[];
      const validOrders = scheduleArray.filter(
        (item) =>
          item["Regent Production"] !== "Finished" &&
          item.Chassis &&
          item.Customer
      );
      callback(validOrders);
    } else {
      callback([]);
    }
  });
  return () => off(scheduleRef);
};

/** -------------------- spec_plan -------------------- */
/** 同时订阅 spec_plan / specPlan / specplan，任一路径有数据就回调（与 DealerPortal 对齐） */
export const subscribeToSpecPlan = (
  callback: (data: SpecPlan | Record<string, any> | any[] ) => void
) => {
  const paths = ["spec_plan", "specPlan", "specplan"];
  const unsubList: Array<() => void> = [];

  paths.forEach((p) => {
    const r = ref(database, p);
    const handler = (snap: any) => {
      const val = snap?.exists() ? snap.val() : null;
      if (val && (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0)) {
        callback(val);
      }
    };
    onValue(r, handler);
    unsubList.push(() => off(r, "value", handler));
  });

  return () => unsubList.forEach((u) => u && u());
};

/** -------------------- dateTrack -------------------- */
/** 同时订阅 dateTrack 与 datetrack，任一路径有数据就回调（兼容大小写差异） */
export const subscribeToDateTrack = (
  callback: (data: DateTrack | Record<string, any> | any[] ) => void
) => {
  const paths = ["dateTrack", "datetrack"];
  const unsubList: Array<() => void> = [];

  paths.forEach((p) => {
    const r = ref(database, p);
    const handler = (snap: any) => {
      const val = snap?.exists() ? snap.val() : null;
      if (val && (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0)) {
        callback(val);
      }
    };
    onValue(r, handler);
    unsubList.push(() => off(r, "value", handler));
  });

  return () => unsubList.forEach((u) => u && u());
};

/** -------------------- 工具函数（保留你的排序/格式化） -------------------- */
// 解析 dd/mm/yyyy 格式的日期
const parseDDMMYYYY = (dateStr: string | null): Date => {
  if (!dateStr || dateStr.trim() === "") return new Date(9999, 11, 31);
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return new Date(9999, 11, 31);
      return date;
    }
  } catch {}
  return new Date(9999, 11, 31);
};

export const sortOrders = (orders: ScheduleItem[]): ScheduleItem[] => {
  return orders.sort((a, b) => {
    const dateA = parseDDMMYYYY(a["Forecast Production Date"]);
    const dateB = parseDDMMYYYY(b["Forecast Production Date"]);
    const dateCompare = dateA.getTime() - dateB.getTime();
    if (dateCompare !== 0) return dateCompare;

    const safeString = (value: any): string => (value == null ? "" : String(value));

    const index1Compare = safeString(a.Index1).localeCompare(safeString(b.Index1));
    if (index1Compare !== 0) return index1Compare;

    const rank1Compare = safeString(a.Rank1).localeCompare(safeString(b.Rank1));
    if (rank1Compare !== 0) return rank1Compare;

    return safeString(a.Rank2).localeCompare(safeString(b.Rank2));
  });
};

export const formatDateDDMMYYYY = (dateStr: string | null): string => {
  if (!dateStr || dateStr.trim() === "") return "Not set";
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return `${day.toString().padStart(2, "0")}/${month
          .toString()
          .padStart(2, "0")}/${year}`;
      }
    }
  } catch {}
  return dateStr;
};

/** -------------------- stock / reallocation -------------------- */
export function subscribeToStock(cb: (value: any) => void) {
  const r = ref(database, "stockorder");
  const handler = (snap: any) => cb(snap?.exists() ? snap.val() ?? {} : {});
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export function subscribeToReallocation(cb: (value: any) => void) {
  const r = ref(database, "reallocation");
  const handler = (snap: any) => cb(snap?.exists() ? snap.val() ?? {} : {});
  onValue(r, handler);
  return () => off(r, "value", handler);
}
