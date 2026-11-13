package com.shopflow.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.shopflow.TestcontainersConfiguration;
import com.shopflow.order.Order;
import com.shopflow.order.OrderService;
import com.shopflow.order.PlaceOrderRequest;
import com.shopflow.product.Product;
import com.shopflow.product.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Integration tests: the report queries against a real PostgreSQL. Other tests leave orders
 * in the same database, so each test measures the change its own orders make.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "app.reports.low-stock-threshold=3")
class ReportApiIntegrationTest {

	@Autowired
	private ReportService reports;

	@Autowired
	private OrderService orders;

	@Autowired
	private ProductRepository products;

	@Autowired
	private Clock clock;

	private Product newProduct(String price, int stock) {
		String sku = "R-" + UUID.randomUUID().toString().substring(0, 8);
		return products.save(new Product(sku, "Report item " + sku, new BigDecimal(price), stock));
	}

	private Order place(Product product, int quantity) {
		return orders.place("casey",
				new PlaceOrderRequest(List.of(new PlaceOrderRequest.Line(product.getId(), quantity))));
	}

	@Test
	void countsOrdersAndRevenueButNotCancelledOnes() {
		Product item = newProduct("10.00", 100);
		ReportResponse before = reports.build();

		place(item, 2);
		place(item, 3);
		Order cancelled = place(item, 4);
		orders.cancel(cancelled.getId());

		ReportResponse after = reports.build();
		assertThat(after.orders() - before.orders()).isEqualTo(2);
		assertThat(after.revenue().subtract(before.revenue())).isEqualByComparingTo("50.00");
		assertThat(after.cancelledOrders() - before.cancelledOrders()).isEqualTo(1);
	}

	@Test
	void givesFourteenDaysEndingTodayAndPutsNewOrdersInToday() {
		Product item = newProduct("7.50", 100);
		ReportResponse before = reports.build();

		place(item, 2);

		ReportResponse after = reports.build();
		LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
		assertThat(after.daily()).hasSize(14);
		assertThat(after.daily().getFirst().date()).isEqualTo(today.minusDays(13));
		ReportResponse.Day todayAfter = after.daily().getLast();
		ReportResponse.Day todayBefore = before.daily().getLast();
		assertThat(todayAfter.date()).isEqualTo(today);
		assertThat(todayAfter.orders() - todayBefore.orders()).isEqualTo(1);
		assertThat(todayAfter.revenue().subtract(todayBefore.revenue())).isEqualByComparingTo("15.00");
		// Nothing in this database is older than today, so the earlier days are zero.
		assertThat(after.daily().getFirst().orders()).isZero();
		assertThat(after.daily().getFirst().revenue()).isEqualByComparingTo("0");
	}

	@Test
	void ranksProductsByUnitsSoldAcrossOrders() {
		// Far more than any other test sells, so this product is certain to come first.
		Product bestSeller = newProduct("2.00", 1_000_000);
		place(bestSeller, 400_000);
		place(bestSeller, 100_000);
		Order cancelled = place(bestSeller, 50_000);
		orders.cancel(cancelled.getId());

		ReportResponse report = reports.build();

		assertThat(report.topProducts()).hasSizeLessThanOrEqualTo(5);
		ReportResponse.ProductSales first = report.topProducts().getFirst();
		assertThat(first.productId()).isEqualTo(bestSeller.getId());
		assertThat(first.productName()).isEqualTo(bestSeller.getName());
		assertThat(first.unitsSold()).isEqualTo(500_000);
		assertThat(first.revenue()).isEqualByComparingTo("1000000.00");
	}

	@Test
	void listsProductsAtOrBelowTheThresholdEmptiestFirst() {
		Product empty = newProduct("1.00", 0);
		Product atThreshold = newProduct("1.00", 3);
		Product plenty = newProduct("1.00", 4);

		ReportResponse report = reports.build();

		assertThat(report.lowStockThreshold()).isEqualTo(3);
		List<Long> ids = report.lowStock().stream().map(ReportResponse.LowStock::id).toList();
		assertThat(ids).contains(empty.getId(), atThreshold.getId()).doesNotContain(plenty.getId());
		assertThat(ids.indexOf(empty.getId())).isLessThan(ids.indexOf(atThreshold.getId()));
		assertThat(report.lowStock()).extracting(ReportResponse.LowStock::stockQuantity).isSorted();
	}

	@Test
	void anOrderThatUsesUpStockPutsTheProductOnTheLowStockList() {
		Product item = newProduct("1.00", 10);
		assertThat(reports.build().lowStock()).extracting(ReportResponse.LowStock::id).doesNotContain(item.getId());

		place(item, 8);

		assertThat(reports.build().lowStock()).filteredOn(low -> low.id().equals(item.getId()))
			.singleElement()
			.satisfies(low -> assertThat(low.stockQuantity()).isEqualTo(2));
	}

}
