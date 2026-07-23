import type { PlanningGateway } from "./ports";
import {
  normalizePlanTitle,
  validateDailyNote,
} from "../domain/planning";

/** Frontend use-case boundary; Rust repeats validation as the trusted boundary. */
export class PlanningService {
  constructor(private readonly gateway: PlanningGateway) {}

  createPlanItem(title: string, parentId: string | null = null) {
    return this.gateway.createPlanItem(normalizePlanTitle(title), parentId);
  }

  listPlanItems() {
    return this.gateway.listPlanItems();
  }

  updatePlanItem(id: string, title: string) {
    return this.gateway.updatePlanItem(id, normalizePlanTitle(title));
  }

  setPlanItemCompleted(id: string, completed: boolean) {
    return this.gateway.setPlanItemCompleted(id, completed);
  }

  deletePlanItem(id: string) {
    return this.gateway.deletePlanItem(id);
  }

  addPlanItemToDay(planItemId: string, day: string) {
    return this.gateway.addPlanItemToDay(planItemId, day);
  }

  listFocusItems(day: string) {
    return this.gateway.listFocusItems(day);
  }

  setCurrentFocusItem(id: string) {
    return this.gateway.setCurrentFocusItem(id);
  }

  setFocusItemCompleted(id: string, completed: boolean) {
    return this.gateway.setFocusItemCompleted(id, completed);
  }

  removeFocusItem(id: string) {
    return this.gateway.removeFocusItem(id);
  }

  getDailyNote(day: string) {
    return this.gateway.getDailyNote(day);
  }

  saveDailyNote(day: string, content: string) {
    return this.gateway.saveDailyNote(day, validateDailyNote(content));
  }

  listDailyRecords() {
    return this.gateway.listDailyRecords();
  }

  subscribe(listener: () => void) {
    return this.gateway.subscribe(listener);
  }
}
