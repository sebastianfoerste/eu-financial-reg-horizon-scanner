import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  addLicenceAction,
  addProductLineAction,
  confirmProductMapAction,
  recalculateProductMapAction,
  removeJurisdictionAction,
  removeLicenceAction,
  removeProductLineAction,
  updateTopicWatchlistAction,
  upsertJurisdictionAction,
} from "@/app/product-maps/actions";
import { AppShell } from "@/components/app-shell";
import { ActionNotice } from "@/components/action-notice";
import { ProductMapConfirmationBadge } from "@/components/product-map-confirmation-badge";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag-list";
import { getActiveOrganisationId } from "@/lib/authz";
import { scorePublicationForProductMap } from "@/lib/impact-scoring";
import { getProductMap, type ProductMapView } from "@/lib/product-maps";
import { assessProductMapConfirmation } from "@/lib/product-map-assurance";
import { listPublications } from "@/lib/publications";
import { loadScoringRules } from "@/lib/scoring-rules";
import { getJurisdictionValues, getTopicPaths, loadTaxonomy } from "@/lib/taxonomy";
import { compactDate } from "@/lib/utils";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const customerSegments = ["RETAIL", "PROFESSIONAL", "ELIGIBLE_COUNTERPARTY", "CORPORATE", "INSTITUTIONAL"];
const licenceStatuses = ["ACTIVE", "APPLIED", "WITHDRAWN", "LAPSED"];

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getOutcomeNotice(params: Record<string, string | string[] | undefined>) {
  if (readParam(params.unchanged)) return "No footprint changes detected. Existing confirmation status remains current.";
  if (readParam(params.confirmation) === "recorded") return "Footprint confirmation recorded for the next quarterly review window.";
  if (readParam(params.created) === "1") return "Product map created. Confirm the footprint before creating alert drafts.";
  if (readParam(params.watchlist) === "updated") return "Concern watchlist updated. Confirmation is required before alert drafts resume.";
  if (readParam(params.licence) === "added") return "Licence added. Confirmation is required before alert drafts resume.";
  if (readParam(params.licence) === "removed") return "Licence removed. Confirmation is required before alert drafts resume.";
  if (readParam(params.productLine) === "added") return "Product line added. Confirmation is required before alert drafts resume.";
  if (readParam(params.productLine) === "removed") return "Product line removed. Confirmation is required before alert drafts resume.";
  if (readParam(params.jurisdiction) === "updated") return "Jurisdiction updated. Confirmation is required before alert drafts resume.";
  if (readParam(params.jurisdiction) === "removed") return "Jurisdiction removed. Confirmation is required before alert drafts resume.";
  if (readParam(params.scores) === "recalculated") return "Stored impact scores recalculated. Affected draft payloads were retired where required.";
  return null;
}

export default async function ProductMapDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const outcomeNotice = getOutcomeNotice(await searchParams);
  const organisationId = await getActiveOrganisationId();
  const [productMap, publications] = await Promise.all([
    getProductMap(id, organisationId),
    listPublications({}, organisationId),
  ]);
  if (!productMap) notFound();

  const taxonomy = loadTaxonomy();
  const rules = loadScoringRules();
  const topicPaths = getTopicPaths(taxonomy);
  const jurisdictions = getJurisdictionValues(taxonomy);
  const confirmation = assessProductMapConfirmation(productMap);
  const scoredPublications = publications
    .map((publication) => ({
      publication,
      score: scorePublicationForProductMap({
        publicationType: publication.publicationType,
        productMap,
        classification: publication.tags,
      }),
    }))
    .sort((a, b) => b.score.score - a.score.score);

  return (
    <AppShell active="/product-maps">
      <div className="space-y-6">
        <Link
          href="/product-maps"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Product maps
        </Link>

        {outcomeNotice ? (
          <ActionNotice tone={confirmation.blocksAlerts ? "warning" : "success"}>{outcomeNotice}</ActionNotice>
        ) : null}

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">
                {productMap.organisationName}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{productMap.name}</h1>
              <p className="mt-2 text-sm text-zinc-600">
                Scoring rule version {rules.version}. Product-map facts remain local.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ProductMapConfirmationBadge assessment={confirmation} />
                <p className="text-xs text-zinc-500">
                  Last confirmed {compactDate(productMap.lastConfirmedAt)} by {productMap.confirmedByName ?? "No reviewer"}.
                  Next due {compactDate(productMap.nextConfirmationDueAt)}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={confirmProductMapAction}>
                <input type="hidden" name="productMapId" value={productMap.id} />
                <input type="hidden" name="reviewerName" value="Sebastian" />
                <button className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800">
                  Confirm footprint
                </button>
              </form>
              <form action={recalculateProductMapAction}>
                <input type="hidden" name="productMapId" value={productMap.id} />
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Recalculate
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
          <aside className="min-w-0 space-y-4">
            <WatchlistEditor productMap={productMap} topicPaths={topicPaths} />
            <LicenceEditor productMap={productMap} licenceTypes={taxonomy.licence_type} />
            <ProductLineEditor productMap={productMap} activities={taxonomy.activity} />
            <JurisdictionEditor productMap={productMap} jurisdictions={jurisdictions} />
          </aside>

          <section className="min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Impact preview</h2>
            </div>
            <div className="divide-y divide-zinc-200">
              {scoredPublications.map(({ publication, score }) => (
                <article key={publication.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold uppercase text-zinc-700">{publication.sourceCode}</span>
                      <span>{publication.publicationType}</span>
                    </div>
                    <Link href={`/publications/${publication.id}`} className="text-sm font-semibold text-zinc-950">
                      {publication.title}
                    </Link>
                    <p className="mt-2 break-words text-sm leading-6 text-zinc-600">{score.rationale}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      Weighted subtotal {score.rawScore}. Floor uplift {score.floorAdjustment}. Final score {score.score}.
                      Rule version {score.ruleVersion}.
                    </p>
                    <div className="mt-3">
                      <TagList
                        tags={[
                          ...score.matchedLicences,
                          ...score.matchedActivities,
                          ...score.matchedJurisdictions,
                          ...score.matchedTopics,
                        ]}
                        limit={12}
                      />
                    </div>
                  </div>
                  <StatusBadge bucket={score.bucket} score={score.score} />
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function WatchlistEditor({ productMap, topicPaths }: { productMap: ProductMapView; topicPaths: string[] }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Concern watchlist</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Topic matches add client-specific relevance points to this product map.
      </p>
      <form action={updateTopicWatchlistAction} className="mt-4 space-y-3">
        <input type="hidden" name="productMapId" value={productMap.id} />
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
          {topicPaths.map((topic) => (
            <Checkbox key={topic} name="topicWatchlist" value={topic} checked={productMap.topicWatchlist.includes(topic)} />
          ))}
        </div>
        <button className="inline-flex h-9 items-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800">
          Save watchlist
        </button>
      </form>
    </section>
  );
}

function LicenceEditor({ productMap, licenceTypes }: { productMap: ProductMapView; licenceTypes: string[] }) {
  return (
    <EditorSection title="Licences">
      <div className="space-y-2">
        {productMap.licences.map((licence) => (
          <div key={licence.id ?? licence.licenceType} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-zinc-950">{licence.licenceType}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {licence.issuingAuthority} / {licence.status}
                  {licence.licenceReference ? ` / ${licence.licenceReference}` : ""}
                </p>
              </div>
              {licence.id ? (
                <RemoveButton action={removeLicenceAction} productMapId={productMap.id} field="licenceId" value={licence.id} label="Remove licence" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <details className="rounded-md border border-zinc-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Add licence</summary>
        <form action={addLicenceAction} className="mt-3 space-y-3">
          <input type="hidden" name="productMapId" value={productMap.id} />
          <Select name="licenceType" label="Licence type" options={licenceTypes} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="issuingAuthority" label="Authority" placeholder="bafin" />
            <Input name="licenceReference" label="Reference" placeholder="Optional" />
          </div>
          <Select name="status" label="Status" options={licenceStatuses} />
          <SaveButton label="Add licence" />
        </form>
      </details>
    </EditorSection>
  );
}

function ProductLineEditor({ productMap, activities }: { productMap: ProductMapView; activities: string[] }) {
  return (
    <EditorSection title="Product lines">
      <div className="space-y-2">
        {productMap.productLines.map((line) => (
          <div key={line.id ?? line.name} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-zinc-950">{line.name}</p>
                <TagList tags={line.activities} limit={8} />
                <p className="text-xs text-zinc-600">
                  {line.isCritical ? "Critical line" : "Standard line"} / {(line.customerSegment ?? []).join(", ")}
                </p>
              </div>
              {line.id ? (
                <RemoveButton action={removeProductLineAction} productMapId={productMap.id} field="productLineId" value={line.id} label="Remove product line" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <details className="rounded-md border border-zinc-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Add product line</summary>
        <form action={addProductLineAction} className="mt-3 space-y-3">
          <input type="hidden" name="productMapId" value={productMap.id} />
          <Input name="name" label="Product line" placeholder="EMT issuance" />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Activities</p>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
              {activities.map((activity) => (
                <Checkbox key={activity} name="activities" value={activity} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Customer segments</p>
            <div className="grid gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 sm:grid-cols-2">
              {customerSegments.map((segment) => (
                <Checkbox key={segment} name="customerSegments" value={segment} />
              ))}
            </div>
          </div>
          <Checkbox name="isCritical" value="on" label="Critical product line" />
          <SaveButton label="Add product line" />
        </form>
      </details>
    </EditorSection>
  );
}

function JurisdictionEditor({ productMap, jurisdictions }: { productMap: ProductMapView; jurisdictions: string[] }) {
  return (
    <EditorSection title="Jurisdictions">
      <div className="space-y-2">
        {productMap.jurisdictions.map((jurisdiction) => (
          <div key={jurisdiction.id ?? jurisdiction.jurisdictionCode} className="flex justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">{jurisdiction.jurisdictionCode}</p>
              <p className="mt-1 text-xs text-zinc-600">
                {jurisdiction.authority ?? "No authority"} / {jurisdiction.isHomeMember ? "Home" : "Non-home"}
                {jurisdiction.isPassportedInto ? " / Passported" : ""}
              </p>
            </div>
            {jurisdiction.id ? (
              <RemoveButton action={removeJurisdictionAction} productMapId={productMap.id} field="jurisdictionId" value={jurisdiction.id} label="Remove jurisdiction" />
            ) : null}
          </div>
        ))}
      </div>
      <details className="rounded-md border border-zinc-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Add or update jurisdiction</summary>
        <form action={upsertJurisdictionAction} className="mt-3 space-y-3">
          <input type="hidden" name="productMapId" value={productMap.id} />
          <Select name="jurisdictionCode" label="Jurisdiction" options={jurisdictions} />
          <Input name="authority" label="Authority" placeholder="bafin" />
          <div className="grid gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 sm:grid-cols-2">
            <Checkbox name="isHomeMember" value="on" label="Home member state" />
            <Checkbox name="isPassportedInto" value="on" label="Passported into" />
          </div>
          <SaveButton label="Save jurisdiction" />
        </form>
      </details>
    </EditorSection>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function Checkbox({
  name,
  value,
  label = value,
  checked = false,
}: {
  name: string;
  value: string;
  label?: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-white">
      <input name={name} value={value} type="checkbox" defaultChecked={checked} className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
      <span className="break-all">{label}</span>
    </label>
  );
}

function Input({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{label}</span>
      <input name={name} placeholder={placeholder} className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950" />
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{label}</span>
      <select name={name} className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SaveButton({ label }: { label: string }) {
  return (
    <button className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800">
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function RemoveButton({
  action,
  productMapId,
  field,
  value,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  productMapId: string;
  field: string;
  value: string;
  label: string;
}) {
  return (
    <details className="shrink-0">
      <summary
        aria-label={label}
        title={label}
        className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:border-red-200 hover:text-red-700 [&::-webkit-details-marker]:hidden"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </summary>
      <form action={action} className="mt-2">
        <input type="hidden" name="productMapId" value={productMapId} />
        <input type="hidden" name={field} value={value} />
        <button className="h-8 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700 hover:bg-red-50">
          Confirm removal
        </button>
      </form>
    </details>
  );
}
