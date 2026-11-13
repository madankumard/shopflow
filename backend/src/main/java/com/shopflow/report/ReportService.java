package com.shopflow.report;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.shopflow.order.OrderStatus;
import com.shopflow.product.ProductRepository;
import com.shopflow.report.ReportRepository.DayTotals;
import com.shopflow.report.ReportRepository.Totals;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

	/** How many days the daily figures cover, today included. */
	static final int DAYS = 14;

	static final int TOP_PRODUCTS = 5;

	private final ReportRepository reports;

	private final ProductRepository products;

	private final Clock clock;

	private final int lowStockThreshold;

	public ReportService(ReportRepository reports, ProductRepository products, Clock clock,
			@Value("${app.reports.low-stock-threshold}") int lowStockThreshold) {
		this.reports = reports;
		this.products = products;
		this.clock = clock;
		this.lowStockThreshold = lowStockThreshold;
	}

	// One read-only transaction, so all the figures describe the same moment.
	@Transactional(readOnly = true)
	public ReportResponse build() {
		Totals totals = reports.totalsExcluding(OrderStatus.CANCELLED);

		LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
		LocalDate firstDay = today.minusDays(DAYS - 1);
		Map<LocalDate, DayTotals> byDay = reports
			.dailyTotals(OrderStatus.CANCELLED, firstDay.atStartOfDay(ZoneOffset.UTC).toInstant())
			.stream()
			.collect(Collectors.toMap(DayTotals::date, Function.identity()));
		// The query only returns days that had orders; fill the quiet days in with zeros.
		List<ReportResponse.Day> daily = firstDay.datesUntil(today.plusDays(1)).map(date -> {
			DayTotals day = byDay.get(date);
			return day == null ? new ReportResponse.Day(date, 0, BigDecimal.ZERO)
					: new ReportResponse.Day(date, day.orders(), day.revenue());
		}).toList();

		List<ReportResponse.ProductSales> topProducts = reports
			.productTotals(OrderStatus.CANCELLED, PageRequest.ofSize(TOP_PRODUCTS))
			.stream()
			.map(product -> new ReportResponse.ProductSales(product.productId(), product.productName(),
					product.unitsSold(), product.revenue()))
			.toList();

		List<ReportResponse.LowStock> lowStock = products
			.findByStockQuantityLessThanEqualOrderByStockQuantityAscNameAsc(lowStockThreshold)
			.stream()
			.map(product -> new ReportResponse.LowStock(product.getId(), product.getSku(), product.getName(),
					product.getStockQuantity()))
			.toList();

		// With no orders at all the database's sum is null, not zero.
		BigDecimal revenue = totals.revenue() == null ? BigDecimal.ZERO : totals.revenue();
		return new ReportResponse(totals.orders(), revenue, reports.countByStatus(OrderStatus.CANCELLED), daily,
				topProducts, lowStockThreshold, lowStock);
	}

}
