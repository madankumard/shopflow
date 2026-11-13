package com.shopflow.report;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.shopflow.order.Order;
import com.shopflow.order.OrderStatus;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Read-only queries for the reports. The database does the adding up, not the application. */
public interface ReportRepository extends Repository<Order, Long> {

	/** Number of orders in the given state of "cancelled or not", and what they add up to. */
	record Totals(long orders, BigDecimal revenue) {
	}

	record DayTotals(LocalDate date, long orders, BigDecimal revenue) {
	}

	record ProductTotals(Long productId, String productName, long unitsSold, BigDecimal revenue) {
	}

	@Query("""
			select new com.shopflow.report.ReportRepository$Totals(count(o), sum(o.total))
			from Order o
			where o.status <> :excluded
			""")
	Totals totalsExcluding(OrderStatus excluded);

	long countByStatus(OrderStatus status);

	/** One row per UTC day that has orders, from the given moment on. */
	@Query("""
			select new com.shopflow.report.ReportRepository$DayTotals(
				cast(o.createdAt as LocalDate), count(o), sum(o.total))
			from Order o
			where o.status <> :excluded and o.createdAt >= :from
			group by cast(o.createdAt as LocalDate)
			order by cast(o.createdAt as LocalDate)
			""")
	List<DayTotals> dailyTotals(OrderStatus excluded, Instant from);

	/** Products by units sold, best first. */
	@Query("""
			select new com.shopflow.report.ReportRepository$ProductTotals(
				l.productId, l.productName, sum(l.quantity), sum(l.unitPrice * l.quantity))
			from OrderLine l
			where l.order.status <> :excluded
			group by l.productId, l.productName
			order by sum(l.quantity) desc, l.productName
			""")
	List<ProductTotals> productTotals(OrderStatus excluded, Pageable limit);

}
