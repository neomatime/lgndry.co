import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DeliveryStatusBadge,
  PaymentStatusBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-badges";
import { DELIVERY_STATUSES, PAYMENT_STATUSES, PROJECT_STATUSES } from "@/features/projects/types";

describe("project badges", () => {
  it.each(PROJECT_STATUSES)("renders the %s project status", (status) => {
    render(<ProjectStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it.each(PAYMENT_STATUSES)("renders the %s payment status", (status) => {
    render(<PaymentStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it.each(DELIVERY_STATUSES)("renders the %s delivery status", (status) => {
    render(<DeliveryStatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });
});
